import { streamText, generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { createRagTools } from "./rag-tools";
import { RAG_SYSTEM_PROMPT, buildRagModelMessages, type ChatTurn } from "./prompts";
import { getCacheStats } from "./rmp-cache";
import type { PrefetchedContext } from "./prefetch";

export async function runRagAgentStreaming(params: {
  query: string;
  conversationHistory: ChatTurn[];
  sessionContext: { currentCourse: string | null; activeCourses: string[] };
  coursesToUse: string[];
  prefetched: PrefetchedContext;
  send: (type: string, data: Record<string, unknown>) => void;
  requestStartTime: number;
}): Promise<void> {
  const {
    query,
    conversationHistory,
    sessionContext,
    coursesToUse,
    prefetched,
    send,
    requestStartTime,
  } = params;

  const tools = createRagTools();
  const messages = buildRagModelMessages({
    query,
    conversationHistory,
    sessionContext,
    suggestedCourses: coursesToUse,
    prefetched,
  });

  send("status", { message: "Thinking with tools...", progress: 25 });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: RAG_SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(16),
  });

  let fullAnswer = "";
  const toolCalls: string[] = [];
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      fullAnswer += part.text;
      send("chunk", { content: part.text });
    }
    if (part.type === "tool-call") {
      toolCalls.push(part.toolName);
      send("tool_call_start", {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
      });
      send("status", {
        message: `Running tool: ${part.toolName}`,
        progress: 50,
      });
    }
    if (part.type === "tool-result") {
      send("tool_call_done", {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        error: false,
      });
    }
    if (part.type === "tool-error") {
      send("tool_call_done", {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        error: true,
      });
    }
  }

  send("complete", {
    answer: fullAnswer,
    toolCalls,
    sessionContext: {
      currentCourse: coursesToUse[0] ?? null,
      activeCourses: coursesToUse,
    },
    _metadata: {
      responseTime: Date.now() - requestStartTime,
      cacheStats: getCacheStats(),
    },
  });
}

export async function runRagAgentGenerate(params: {
  query: string;
  conversationHistory: ChatTurn[];
  sessionContext: { currentCourse: string | null; activeCourses: string[] };
  coursesToUse: string[];
  prefetched: PrefetchedContext;
}): Promise<{
  answer: string;
  sessionContext: {
    currentCourse: string | null;
    activeCourses: string[];
  };
  _metadata: { cacheStats: ReturnType<typeof getCacheStats> };
}> {
  const { query, conversationHistory, sessionContext, coursesToUse, prefetched } = params;
  const tools = createRagTools();
  const messages = buildRagModelMessages({
    query,
    conversationHistory,
    sessionContext,
    suggestedCourses: coursesToUse,
    prefetched,
  });

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: RAG_SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(16),
  });

  return {
    answer: text,
    sessionContext: {
      currentCourse: coursesToUse[0] ?? null,
      activeCourses: coursesToUse,
    },
    _metadata: { cacheStats: getCacheStats() },
  };
}
