import { tool } from "ai";
import { z } from "zod";
import {
  checkMultipleCoursesExist,
  fetchCourseGpaSummary,
  rankInstructorsInCourseByGpa,
  fetchCourseInfo,
  searchProfessorsByName,
  getInstructorRowsInCourse,
  listCourseTableNames,
  fetchRmpLinksForInstructors,
  findCoursesForInstructor,
  rankCoursesByAverageGpa,
  compareCoursesOverallGpa,
} from "./queries";
import { scrapeRmpProfessors } from "./rmp-scrape";

export function createRagTools() {
  return {
    resolve_courses: tool({
      description:
        "Check which Texas A&M course codes exist in the database (e.g. CSCE 221). Call this when the user mentions course(s).",
      inputSchema: z.object({
        courses: z
          .array(z.string())
          .describe('Course codes like "CSCE 221" or "MATH 151"'),
      }),
      execute: async ({ courses }) => {
        const result = await checkMultipleCoursesExist(courses);
        return { exists: result };
      },
    }),

    get_course_gpa_summary: tool({
      description:
        "Per-instructor, per-term GPA rows for one course (not pre-aggregated across terms). " +
        "For ranking all professors in a course by overall GPA, prefer rank_instructors_in_course_by_gpa. " +
        "If the user cares about a named professor, follow with fetch_rmp_profiles using instructor strings from results.",
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

    rank_instructors_in_course_by_gpa: tool({
      description:
        "Rank every instructor who appears in one course's grade data by overall average GPA (higher = easier grades on average). " +
        "Use when the user names a course and wants professors ranked or listed (e.g. rank ECEN 314 professors). " +
        "When discussing specific names from the result, call fetch_rmp_profiles for those instructors. " +
        "This is NOT find_courses_for_instructor — that tool searches by professor name across all courses.",
      inputSchema: z.object({
        course: z.string().describe('e.g. "ECEN 314"'),
        limit: z
          .number()
          .optional()
          .default(200)
          .describe("Max instructors to return (default 200, cap 200)"),
      }),
      execute: async ({ course, limit }) => {
        return rankInstructorsInCourseByGpa(course, limit ?? 200);
      },
    }),

    get_full_course_breakdown: tool({
      description:
        "Full per-term breakdown for a course (same as summary but unbounded ordering; use for deep dives).",
      inputSchema: z.object({
        course: z.string(),
      }),
      execute: async ({ course }) => {
        return fetchCourseInfo(course);
      },
    }),

    search_professors_by_name: tool({
      description:
        "Search the professor directory by name. Names are stored as LAST, F. (e.g. O'KANE, J., LEYK, T.). " +
        "Substring ILIKE matches; multi-word Western order (e.g. Teresa Leyk) also matches the corresponding LAST, F. row via last name + first initial. " +
        "Returns instructor, rmp_link, department — use rmp_link for RateMyProfessor URLs.",
      inputSchema: z.object({
        query: z.string().describe("Part of last name or full name as stored"),
        limit: z.number().optional().default(15),
      }),
      execute: async ({ query, limit }) => {
        return searchProfessorsByName(query, limit ?? 15);
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

    list_course_tables: tool({
      description:
        "List course tables (table names map to course codes, e.g. csce221 -> CSCE 221). " +
        "Always pass tableNamePrefix when the user asks for one department (e.g. CSCE, MATH) so all matching tables are returned (up to 500). " +
        "Returns courseCodes from table names only — do not invent course titles.",
      inputSchema: z.object({
        tableNamePrefix: z
          .string()
          .optional()
          .describe(
            "Prefix to filter table_name ILIKE 'prefix%'. Use for 'what CSCE courses' questions (e.g. CSCE or csce)."
          ),
        limit: z
          .number()
          .optional()
          .describe("Max rows (default 500 with prefix, 300 without). Cap 500."),
      }),
      execute: async ({ tableNamePrefix, limit }) => {
        return listCourseTableNames({
          tableNamePrefix: tableNamePrefix ?? null,
          limit,
        });
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

    compare_courses_by_overall_gpa: tool({
      description:
        "Compare overall average GPA across a specific list of courses the user named (e.g. which is easier: CSCE 221, 222, 310, 313). " +
        "Returns avg_gpa and section count for each listed course only. Use this instead of rank_courses_by_avg_gpa for explicit A-vs-B comparisons.",
      inputSchema: z.object({
        courses: z
          .array(z.string())
          .min(2)
          .max(15)
          .describe('Course codes like "CSCE 221", "CSCE 310"'),
      }),
      execute: async ({ courses }) => {
        return compareCoursesOverallGpa(courses);
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

    get_ratemyprofessor_links: tool({
      description:
        "Best tool when the user only wants RateMyProfessor profile URL(s) for a professor by name. " +
        "The professor table stores names as LAST, F. (e.g. LEYK, T.); natural names like 'Teresa Leyk' are matched to that format. Returns urls from the database (no scraping).",
      inputSchema: z.object({
        nameQuery: z
          .string()
          .describe("Professor name as the user said it (e.g. Teresa Leyk, Leyk)"),
        limit: z.number().optional().default(12),
      }),
      execute: async ({ nameQuery, limit }) => {
        const { matches } = await searchProfessorsByName(nameQuery, limit ?? 12);
        type Row = {
          instructor: string;
          rmp_link: string | null;
          department: string | null;
        };
        const rows = matches as Row[];
        const rateMyProfessorUrls = rows
          .filter((m) => m.rmp_link)
          .map((m) => ({
            instructor: m.instructor,
            rateMyProfessorUrl: m.rmp_link as string,
            department: m.department,
          }));
        const matchesWithoutUrl = rows
          .filter((m) => !m.rmp_link)
          .map((m) => ({ instructor: m.instructor, department: m.department }));
        return { rateMyProfessorUrls, matchesWithoutUrl };
      },
    }),

    fetch_rmp_profiles: tool({
      description:
        "Fetch RateMyProfessor scraped data: overall rating, difficulty, would-take-again, top tags. " +
        "**Use whenever** you compare named professors, advise on who to take, or pair GPA with teaching reputation—after GPA tools return, pass the **instructor** strings from those rows (LAST, F.). " +
        "Also returns rateMyProfessorUrls. Link-only: prefer get_ratemyprofessor_links. Names can be natural; server fuzzy-matches the professor table.",
      inputSchema: z.object({
        instructorNames: z
          .array(z.string())
          .max(8)
          .describe(
            "Up to 8 names: prefer exact strings from grade-tool rows, or from search_professors_by_name"
          ),
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
  };
}
