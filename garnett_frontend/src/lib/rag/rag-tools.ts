import { tool } from "ai";
import { z } from "zod";
import {
  fetchCourseGpaSummary,
  getInstructorRowsInCourse,
  fetchRmpLinksForInstructors,
  findCoursesForInstructor,
  rankCoursesByAverageGpa,
} from "./queries";
import { scrapeRmpProfessors } from "./rmp-scrape";

type WebSearchSource = {
  title?: string;
  url?: string;
};

type WebSearchResult = {
  summary: string;
  sources: WebSearchSource[];
};

async function runOpenAiWebSearch(query: string): Promise<WebSearchResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview", search_context_size: "high" }],
      input:
        `Search for up-to-date Texas A&M University (College Station) context.\n\n` +
        `Query: ${query}\n\n` +
        `Return concise findings focused on course/professor advising context. Include reliable sources.`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Web search request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
        annotations?: Array<{
          type?: string;
          title?: string;
          url?: string;
        }>;
      }>;
    }>;
  };

  const sourcesMap = new Map<string, WebSearchSource>();
  for (const item of json.output ?? []) {
    for (const content of item.content ?? []) {
      for (const ann of content.annotations ?? []) {
        if (ann.type === "url_citation" && ann.url) {
          sourcesMap.set(ann.url, { title: ann.title, url: ann.url });
        }
      }
    }
  }

  return {
    summary: json.output_text ?? "",
    sources: Array.from(sourcesMap.values()).slice(0, 8),
  };
}

export function createRagTools() {
  return {
    get_course_gpa_summary: tool({
      description:
        "Per-instructor, per-term GPA rows for one course (not pre-aggregated across terms). " +
        "Use for deeper term-by-term analysis when the pre-fetched summary is not enough.",
      inputSchema: z.object({
        course: z.string().describe('e.g. "CSCE 221"'),
        limitRows: z
          .number()
          .optional()
          .default(120)
          .describe("Max rows to return (default 120)"),
      }),
      execute: async ({ course, limitRows }) => {
        return fetchCourseGpaSummary(course, limitRows ?? 120);
      },
    }),

    get_instructor_rows_in_course: tool({
      description:
        "Get section-level rows (grade counts, GPA) for instructors matching a name in one course. " +
        "Grade data uses LAST, F. (e.g. CHU, W.); natural names like Wenhui Chu are matched automatically. " +
        "For comparisons between named professors, also call fetch_rmp_profiles with the instructor field values from rows.",
      inputSchema: z.object({
        course: z.string(),
        instructorPattern: z
          .string()
          .describe("Name as user said it or LAST, F.; e.g. Wenhui Chu or CHU, W."),
        limitRows: z.number().optional().default(40),
      }),
      execute: async ({ course, instructorPattern, limitRows }) => {
        return getInstructorRowsInCourse(
          course,
          instructorPattern,
          limitRows ?? 40
        );
      },
    }),

    rank_courses_by_avg_gpa: tool({
      description:
        "Rank courses in a department by overall average GPA (higher = easier on average). " +
        "Returns only the top `topN` courses in that department — any course not in that list still has data; it is simply not in the top tier. " +
        "If the user lists specific course codes to compare (e.g. CSCE 221 vs 313), use compare_courses_by_overall_gpa instead. " +
        "Optional minCourseNumber/maxCourseNumber for level bands (e.g. 400–499).",
      inputSchema: z.object({
        tableNamePrefix: z
          .string()
          .describe("Department prefix matching table names, e.g. CSCE or csce"),
        minCourseNumber: z
          .number()
          .optional()
          .describe("Inclusive lower bound on course number from table name (e.g. 400 for 400-level)"),
        maxCourseNumber: z
          .number()
          .optional()
          .describe("Inclusive upper bound (e.g. 499 for undergraduate 400-level)"),
        topN: z
          .number()
          .optional()
          .describe("How many courses to return after sorting (default 25, max 100)"),
      }),
      execute: async ({ tableNamePrefix, minCourseNumber, maxCourseNumber, topN }) => {
        return rankCoursesByAverageGpa({
          tableNamePrefix,
          minCourseNumber: minCourseNumber ?? null,
          maxCourseNumber: maxCourseNumber ?? null,
          topN,
        });
      },
    }),

    find_courses_for_instructor: tool({
      description:
        "Given a PROFESSOR name (substring), find which course tables they appear in. " +
        "Input must be an instructor name, never a course code. " +
        "If the user names a course and wants its professors ranked, use rank_instructors_in_course_by_gpa instead. " +
        "Optional department prefix (e.g. CSCE) narrows which tables are scanned.",
      inputSchema: z.object({
        instructorPattern: z
          .string()
          .describe("Professor name substring (e.g. 'PEARCE', 'Leyk', 'CHU') — not a course like ECEN 314"),
        department: z
          .string()
          .optional()
          .describe("Optional department prefix to narrow search (e.g. 'CSCE')"),
      }),
      execute: async ({ instructorPattern, department }) => {
        return findCoursesForInstructor(instructorPattern, department);
      },
    }),

    fetch_rmp_profiles: tool({
      description:
        "Fetch RateMyProfessor scraped data: overall rating, difficulty, would-take-again, top tags. " +
        "**Use whenever** you compare named professors, advise on who to take, or pair GPA with teaching reputation—after GPA tools return, pass the **instructor** strings from those rows (LAST, F.).",
      inputSchema: z.object({
        instructorNames: z
          .array(z.string())
          .max(8)
          .describe("Up to 8 names; prefer exact strings from grade-tool rows"),
      }),
      execute: async ({ instructorNames }) => {
        const { links } = await fetchRmpLinksForInstructors(instructorNames);
        const urls = links.map((l) => l.rmp_link);
        const scraped = await scrapeRmpProfessors(urls);
        const rateMyProfessorUrls = links
          .filter((l) => l.rmp_link)
          .map((l) => ({
            instructor: l.instructor,
            url: l.rmp_link as string,
          }));
        return {
          rateMyProfessorUrls,
          links,
          profilesByProfId: scraped,
        };
      },
    }),

    web_search_tamu_context: tool({
      description:
        "Search the live web for additional context about Texas A&M University (College Station) courses/professors. " +
        "Use this for recent updates, instructor/course context, syllabus/catalog pages, and other TAMU-adjacent details not present in pre-fetched DB data.",
      inputSchema: z.object({
        courseName: z.string().optional().describe('Optional course name/code (e.g. "CSCE 221")'),
        professorName: z.string().optional().describe('Optional professor name'),
        userQuestion: z.string().describe("The user question to ground search intent"),
      }),
      execute: async ({ courseName, professorName, userQuestion }) => {
        const query = [
          "Texas A&M University College Station",
          courseName ? `Course: ${courseName}` : null,
          professorName ? `Professor: ${professorName}` : null,
          `Question: ${userQuestion}`,
        ]
          .filter(Boolean)
          .join(". ");

        const result = await runOpenAiWebSearch(query);
        return {
          query,
          keyFindings: result.summary,
          sources: result.sources,
          sourceCount: result.sources.length,
        };
      },
    }),
  };
}
