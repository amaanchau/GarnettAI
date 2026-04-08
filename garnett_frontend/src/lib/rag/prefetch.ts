import { pool } from "./db-pool";
import {
  courseToTableName,
  formatTableNameAsCourseCode,
  isSafeTableName,
} from "./course-utils";
import { fetchRmpLinksForInstructors } from "./queries";
import { scrapeRmpProfessors } from "./rmp-scrape";

export type InstructorSummary = {
  instructor: string;
  avg_gpa: number;
  n_sections: number;
  n_terms: number;
};

export type CourseSummary = {
  course: string;
  overall_avg_gpa: number | null;
  total_sections: number;
  instructors: InstructorSummary[];
};

export type RmpSnapshot = {
  instructor: string;
  rmp_link: string | null;
  profId: string | null;
  rating: string;
  total_ratings: string;
  would_take_again: string;
  difficulty: string;
  top_tags: string[];
};

export type PrefetchedContext = {
  selectedCourses: string[];
  selectedProfessorsByCourse: Record<string, string[]>;
  courseSummaries: CourseSummary[];
  rmpSnapshots: RmpSnapshot[];
};

/**
 * List all course table names for the UI picker (formatted as course codes).
 */
export async function listAllCourseCodes(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name != 'professor'
       ORDER BY table_name`
    );
    return rows
      .map((r) => r.table_name)
      .filter(isSafeTableName)
      .map(formatTableNameAsCourseCode);
  } finally {
    client.release();
  }
}

/**
 * List distinct instructors in one course table (for the professor picker).
 */
export async function listInstructorsForCourse(
  course: string
): Promise<InstructorSummary[]> {
  const table = courseToTableName(course);
  if (!isSafeTableName(table)) return [];
  const client = await pool.connect();
  try {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (exists.rows.length === 0) return [];

    const { rows } = await client.query<{
      instructor: string;
      avg_gpa: string | number;
      n_sections: number;
      n_terms: number;
    }>(
      `SELECT instructor,
              ROUND(AVG(average_gpa)::numeric, 3) AS avg_gpa,
              COUNT(*)::int AS n_sections,
              COUNT(DISTINCT term)::int AS n_terms
       FROM ${table}
       GROUP BY instructor
       HAVING COUNT(*) > 0 AND AVG(average_gpa) IS NOT NULL
       ORDER BY AVG(average_gpa) DESC NULLS LAST, instructor ASC`
    );
    return rows.map((r) => ({
      instructor: r.instructor,
      avg_gpa: Number(r.avg_gpa),
      n_sections: r.n_sections,
      n_terms: r.n_terms,
    }));
  } catch (e) {
    console.error("listInstructorsForCourse:", e);
    return [];
  } finally {
    client.release();
  }
}

const MAX_RMP_PREFETCH = 8;

/**
 * Auto-prefetch core data for selected courses and optional professors.
 * Returns structured context the agent receives as part of its prompt.
 */
export async function prefetchSelectedContext(
  selectedCourses: string[],
  selectedProfessorsByCourse: Record<string, string[]> = {}
): Promise<PrefetchedContext> {
  const courseSummaries: CourseSummary[] = [];

  for (const course of selectedCourses) {
    const table = courseToTableName(course);
    if (!isSafeTableName(table)) {
      courseSummaries.push({
        course,
        overall_avg_gpa: null,
        total_sections: 0,
        instructors: [],
      });
      continue;
    }
    const instructors = await listInstructorsForCourse(course);
    const selectedProfs = selectedProfessorsByCourse[course];
    const filteredInstructors =
      selectedProfs && selectedProfs.length > 0
        ? instructors.filter((inst) => selectedProfs.includes(inst.instructor))
        : instructors;

    const totalSections = filteredInstructors.reduce(
      (sum, i) => sum + i.n_sections,
      0
    );
    const weightedGpaSum = filteredInstructors.reduce(
      (sum, i) => sum + i.avg_gpa * i.n_sections,
      0
    );
    const overallGpa =
      totalSections > 0
        ? Math.round((weightedGpaSum / totalSections) * 1000) / 1000
        : null;

    courseSummaries.push({
      course,
      overall_avg_gpa: overallGpa,
      total_sections: totalSections,
      instructors: filteredInstructors,
    });
  }

  const profNamesToFetchRmp: string[] = [];
  const hasSelectedProfs = Object.values(selectedProfessorsByCourse).some(
    (arr) => arr.length > 0
  );
  if (hasSelectedProfs) {
    for (const profs of Object.values(selectedProfessorsByCourse)) {
      for (const p of profs) {
        if (!profNamesToFetchRmp.includes(p)) profNamesToFetchRmp.push(p);
      }
    }
  } else {
    for (const cs of courseSummaries) {
      for (const inst of cs.instructors.slice(0, 5)) {
        if (!profNamesToFetchRmp.includes(inst.instructor))
          profNamesToFetchRmp.push(inst.instructor);
      }
    }
  }

  const rmpNames = profNamesToFetchRmp.slice(0, MAX_RMP_PREFETCH);
  const rmpSnapshots: RmpSnapshot[] = [];

  if (rmpNames.length > 0) {
    try {
      const { links } = await fetchRmpLinksForInstructors(rmpNames);
      const urls = links.map((l) => l.rmp_link);
      const scraped = await scrapeRmpProfessors(urls);

      for (const link of links) {
        const profId = link.rmp_link?.split("/").pop() ?? null;
        const profile = profId ? (scraped[profId] as Record<string, unknown> | undefined) : undefined;
        rmpSnapshots.push({
          instructor: link.instructor,
          rmp_link: link.rmp_link,
          profId,
          rating: (profile?.rating as string) ?? "N/A",
          total_ratings: (profile?.total_ratings as string) ?? "N/A",
          would_take_again: (profile?.would_take_again as string) ?? "N/A",
          difficulty: (profile?.difficulty as string) ?? "N/A",
          top_tags: (profile?.top_tags as string[]) ?? [],
        });
      }
    } catch (e) {
      console.error("prefetchSelectedContext RMP:", e);
    }
  }

  return {
    selectedCourses,
    selectedProfessorsByCourse,
    courseSummaries,
    rmpSnapshots,
  };
}

/**
 * Render prefetched context as compact text for the agent's user message.
 */
export function renderPrefetchedContext(ctx: PrefetchedContext): string {
  const lines: string[] = [];
  lines.push(
    `## Selected courses: ${ctx.selectedCourses.join(", ")}`
  );

  for (const cs of ctx.courseSummaries) {
    const profSelection = ctx.selectedProfessorsByCourse[cs.course];
    const hasSelection = profSelection && profSelection.length > 0;
    lines.push("");
    lines.push(
      `### ${cs.course} (overall avg GPA: ${cs.overall_avg_gpa ?? "N/A"}, ${cs.total_sections} sections)`
    );
    if (hasSelection) {
      lines.push(
        `Selected professors: ${profSelection.join(", ")}`
      );
    }
    lines.push("Instructors (by avg GPA desc):");
    for (const inst of cs.instructors) {
      lines.push(
        `- ${inst.instructor}: avg_gpa=${inst.avg_gpa}, sections=${inst.n_sections}, terms=${inst.n_terms}`
      );
    }
  }

  if (ctx.rmpSnapshots.length > 0) {
    lines.push("");
    lines.push("### RateMyProfessor data (pre-fetched):");
    for (const snap of ctx.rmpSnapshots) {
      lines.push(
        `- ${snap.instructor}: rating=${snap.rating}, difficulty=${snap.difficulty}, would_take_again=${snap.would_take_again}, tags=[${snap.top_tags.join(", ")}]`
      );
    }
  }

  return lines.join("\n");
}
