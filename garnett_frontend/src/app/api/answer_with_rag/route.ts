import { checkMultipleCoursesExist } from "@/lib/rag/queries";
import {
  runRagAgentGenerate,
  runRagAgentStreaming,
} from "@/lib/rag/run-agent";
import { prefetchSelectedContext } from "@/lib/rag/prefetch";

type SessionContext = {
  currentCourse: string | null;
  activeCourses: string[];
};

function makeSseResponse(data: Record<string, unknown>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log("=== RAG API (agent) Request Started ===");

  try {
    const body = await req.json();
    const query = body.query as string;
    const conversationHistory = (body.conversationHistory || []) as {
      isUser: boolean;
      content: string;
    }[];
    const sessionContext = (body.sessionContext || {
      currentCourse: null,
      activeCourses: [],
    }) as SessionContext;
    const useStreaming = body.useStreaming !== false;

    const rawSelectedCourses: unknown = body.selectedCourses;
    const rawSelectedProfs: unknown = body.selectedProfessorsByCourse;

    console.log(`Query: "${query}" (Streaming: ${useStreaming})`);

    if (!query) {
      return Response.json({ error: "Missing query" }, { status: 400 });
    }

    if (
      !Array.isArray(rawSelectedCourses) ||
      rawSelectedCourses.length === 0 ||
      !rawSelectedCourses.every((c): c is string => typeof c === "string")
    ) {
      return Response.json(
        { error: "selectedCourses must be a non-empty string array (max 5)" },
        { status: 400 }
      );
    }

    const selectedCourses: string[] = rawSelectedCourses.slice(0, 5);
    const selectedProfessorsByCourse: Record<string, string[]> =
      rawSelectedProfs && typeof rawSelectedProfs === "object"
        ? (rawSelectedProfs as Record<string, string[]>)
        : {};

    const existenceResults = await checkMultipleCoursesExist(selectedCourses);
    const validCourses = selectedCourses.filter((c) => existenceResults[c]);
    const invalidCourses = selectedCourses.filter((c) => !existenceResults[c]);

    if (validCourses.length === 0) {
      const courseString = invalidCourses.join(", ");
      const answer = `Howdy! I don't have any data for ${courseString}. This might not be a valid Texas A&M course code, or we haven't loaded this course's data yet. Please check the course code and try again, or ask about a different course.`;
      if (!useStreaming) {
        return Response.json({
          answer,
          sessionContext: { currentCourse: null, activeCourses: [] },
        });
      }
      return makeSseResponse({
        type: "complete",
        answer,
        sessionContext: { currentCourse: null, activeCourses: [] },
        _metadata: { responseTime: Date.now() - requestStartTime },
      });
    }

    const coursesToUse = validCourses;

    if (!useStreaming) {
      const prefetched = await prefetchSelectedContext(
        coursesToUse,
        selectedProfessorsByCourse
      );
      const result = await runRagAgentGenerate({
        query,
        conversationHistory,
        sessionContext,
        coursesToUse,
        prefetched,
      });
      const totalTime = Date.now() - requestStartTime;
      console.log(`=== RAG API Completed in ${totalTime}ms ===`);
      return Response.json({
        answer: result.answer,
        sessionContext: result.sessionContext,
        _metadata: {
          responseTime: totalTime,
          ...result._metadata,
        },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const send = (type: string, data: Record<string, unknown>) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
            );
          };

          const prefetchId = "prefetch_" + Date.now();
          send("tool_call_start", {
            toolCallId: prefetchId,
            toolName: "prefetch_course_data",
          });

          const prefetched = await prefetchSelectedContext(
            coursesToUse,
            selectedProfessorsByCourse
          );

          send("tool_call_done", {
            toolCallId: prefetchId,
            toolName: "prefetch_course_data",
            error: false,
          });

          await runRagAgentStreaming({
            query,
            conversationHistory,
            sessionContext,
            coursesToUse,
            prefetched,
            send,
            requestStartTime,
          });
        } catch (error: unknown) {
          console.error("[Streaming Error]:", error);
          const msg = error instanceof Error ? error.message : "Internal Server Error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: unknown) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[RAG Error] after ${totalTime}ms:`, error);
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
