import { pool } from "./db-pool";
import {
  courseToTableName,
  formatTableNameAsCourseCode,
  isSafeTableName,
  parseCourseNumberFromTableName,
  sanitizeTableNamePrefix,
} from "./course-utils";

export async function checkMultipleCoursesExist(
  courses: string[]
): Promise<Record<string, boolean>> {
  if (!courses || courses.length === 0) return {};
  const tables = courses.map((c) => courseToTableName(c));
  const client = await pool.connect();
  try {
    const placeholders = tables.map((_, i) => `$${i + 1}`).join(", ");
    const q = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (${placeholders})
    `;
    const { rows } = await client.query(q, tables);
    const existing = new Set(rows.map((r) => r.table_name));
    const results: Record<string, boolean> = {};
    courses.forEach((course) => {
      results[course] = existing.has(courseToTableName(course));
    });
    return results;
  } finally {
    client.release();
  }
}

export async function fetchCourseInfo(course: string) {
  const table = courseToTableName(course);
  if (!isSafeTableName(table)) {
    return { per_term: [], overall: [] };
  }
  const client = await pool.connect();
  try {
    const perTermQuery = `
  SELECT instructor, term, COUNT(*) AS num_sections_in_term,
         ROUND(AVG(average_gpa)::numeric, 2) AS avg_gpa_in_term
  FROM ${table}
  GROUP BY instructor, term
  ORDER BY avg_gpa_in_term DESC
    `;
    const perTerm = (await client.query(perTermQuery)).rows;
    const instructorSet = new Set<string>();
    perTerm.forEach((row: { instructor: string }) =>
      instructorSet.add(row.instructor)
    );
    const overall = Array.from(instructorSet).map((instructor) => ({ instructor }));
    return { per_term: perTerm, overall };
  } catch (error) {
    console.error(`Error fetching course info for ${course}:`, error);
    return { per_term: [], overall: [] };
  } finally {
    client.release();
  }
}

export async function fetchCourseGpaSummary(
  course: string,
  limitRows: number
) {
  const table = courseToTableName(course);
  if (!isSafeTableName(table)) {
    return { error: "Invalid course code", rows: [] };
  }
  const lim = Math.min(Math.max(1, limitRows), 500);
  const client = await pool.connect();
  try {
    const q = `
  SELECT instructor, term, COUNT(*) AS num_sections_in_term,
         ROUND(AVG(average_gpa)::numeric, 2) AS avg_gpa_in_term
  FROM ${table}
  GROUP BY instructor, term
  ORDER BY avg_gpa_in_term DESC
  LIMIT ${lim}
    `;
    const { rows } = await client.query(q);
    return { course, rows };
  } catch (e) {
    console.error(e);
    return { error: String(e), rows: [] };
  } finally {
    client.release();
  }
}

/**
 * All distinct instructors in one course table, ranked by overall average GPA
 * (across all sections/rows). For "rank professors in ECEN 314" style questions.
 */
export async function rankInstructorsInCourseByGpa(
  course: string,
  limitRows?: number
) {
  const table = courseToTableName(course);
  if (!isSafeTableName(table)) {
    return {
      error: "Invalid course code",
      rankings: [] as Array<{
        instructor: string;
        avg_gpa: number;
        n_sections: number;
        n_terms: number;
      }>,
    };
  }
  const lim = Math.min(Math.max(1, limitRows ?? 200), 200);
  const client = await pool.connect();
  try {
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
       ORDER BY AVG(average_gpa) DESC NULLS LAST, instructor ASC
       LIMIT $1`,
      [lim]
    );
    const rankings = rows.map((r) => ({
      instructor: r.instructor,
      avg_gpa: Number(r.avg_gpa),
      n_sections: r.n_sections,
      n_terms: r.n_terms,
    }));
    return {
      course: formatTableNameAsCourseCode(table),
      totalInstructors: rankings.length,
      limit: lim,
      rankings,
    };
  } catch (e) {
    console.error("rankInstructorsInCourseByGpa:", e);
    return { error: String(e), rankings: [] };
  } finally {
    client.release();
  }
}

/**
 * Professor table uses "LAST, F." (e.g. LEYK, T., O'KANE, J.). Build a lowercase
 * substring key "last, f" so strpos(lower(instructor), key) matches that row.
 * Handles queries already in LAST, F. form or Western "Firstname Lastname".
 */
function lastCommaInitialKey(trimmed: string): string | null {
  const t = trimmed.trim();
  if (!t) return null;

  if (/,/.test(t)) {
    const idx = t.indexOf(",");
    const lastPart = t.slice(0, idx).trim();
    const afterComma = t.slice(idx + 1).trim();
    const initial = afterComma.replace(/[^a-zA-Z]/g, "").charAt(0);
    const lastLetters = lastPart.replace(/[^a-zA-Z\-']/g, "");
    if (lastLetters.length >= 1 && initial) {
      return `${lastLetters.toLowerCase()}, ${initial.toLowerCase()}`;
    }
    return null;
  }

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lastRaw = parts[parts.length - 1]!;
  const firstRaw = parts[0]!;
  const lastLetters = lastRaw.replace(/[^a-zA-Z\-']/g, "");
  const firstLetter = firstRaw.replace(/[^a-zA-Z]/g, "").charAt(0);
  if (lastLetters.length < 1 || !firstLetter) return null;
  return `${lastLetters.toLowerCase()}, ${firstLetter.toLowerCase()}`;
}

/** All significant tokens must appear (fallback when comma-key is not enough). */
function professorNameTokens(trimmed: string): string[] {
  return trimmed
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z\-']/g, ""))
    .filter((t) => t.length >= 2)
    .map((t) => t.toLowerCase());
}

export async function searchProfessorsByName(query: string, limit: number) {
  const lim = Math.min(Math.max(1, limit), 50);
  const trimmed = query.trim();
  const client = await pool.connect();
  try {
    const escaped = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;

    const commaKey = lastCommaInitialKey(trimmed);
    const tokens = professorNameTokens(trimmed);

    const params: Array<string | number> = [pattern];
    let where = `instructor ILIKE $1`;
    let preferParamIndex: number | null = null;

    if (commaKey) {
      params.push(commaKey);
      where = `(${where} OR strpos(lower(instructor), $2) > 0)`;
      preferParamIndex = 2;
    } else if (tokens.length >= 2) {
      const start = params.length + 1;
      const fuzzyConds = tokens
        .map((_, i) => `strpos(lower(instructor), $${start + i}) > 0`)
        .join(" AND ");
      where = `(${where} OR (${fuzzyConds}))`;
      params.push(...tokens);
      preferParamIndex = 2;
    }

    params.push(lim);
    const limitParam = `$${params.length}`;

    const orderBy =
      preferParamIndex != null
        ? `CASE WHEN strpos(lower(instructor), $${preferParamIndex}) > 0 THEN 0 ELSE 1 END, char_length(instructor), instructor`
        : `instructor`;

    const sql = `SELECT instructor, rmp_link, department
                 FROM professor
                 WHERE ${where}
                 ORDER BY ${orderBy}
                 LIMIT ${limitParam}`;

    const { rows } = await client.query(sql, params);
    return { matches: rows };
  } finally {
    client.release();
  }
}

export async function getInstructorRowsInCourse(
  course: string,
  instructorPattern: string,
  limitRows: number
) {
  const table = courseToTableName(course);
  if (!isSafeTableName(table)) {
    return { error: "Invalid course code", rows: [] };
  }
  const lim = Math.min(Math.max(1, limitRows), 100);
  const client = await pool.connect();
  try {
    const trimmed = instructorPattern.trim();
    const escaped = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;
    const commaKey = lastCommaInitialKey(trimmed);

    const params: Array<string | number> = [pattern];
    const whereSql = commaKey
      ? `(instructor ILIKE $1 OR strpos(lower(instructor), $2) > 0)`
      : `instructor ILIKE $1`;
    if (commaKey) {
      params.push(commaKey);
    }
    params.push(lim);
    const limitPh = `$${params.length}`;

    const { rows } = await client.query(
      `SELECT term, section, instructor, total, average_gpa, a, b, c, d, f
       FROM ${table}
       WHERE ${whereSql}
       ORDER BY term DESC
       LIMIT ${limitPh}`,
      params
    );
    return { course, rows };
  } catch (e) {
    console.error(e);
    return { error: String(e), rows: [] };
  } finally {
    client.release();
  }
}

const MAX_LIST_TABLES = 500;

export async function listCourseTableNames(options: {
  limit?: number;
  /** Filter table_name ILIKE 'prefix%' (e.g. "csce" for all CSCE tables). */
  tableNamePrefix?: string | null;
} = {}) {
  const lim = Math.min(
    Math.max(1, options.limit ?? (options.tableNamePrefix ? 500 : 300)),
    MAX_LIST_TABLES
  );
  const client = await pool.connect();
  try {
    const prefix = options.tableNamePrefix
      ? sanitizeTableNamePrefix(options.tableNamePrefix)
      : null;

    if (options.tableNamePrefix && prefix === null) {
      return {
        tableNames: [] as string[],
        courseCodes: [] as string[],
        error: "Invalid table name prefix (use letters/numbers only, e.g. CSCE).",
      };
    }

    const params: Array<string | number> = [];
    let whereClause = `WHERE table_schema = 'public'
         AND table_name != 'professor'`;

    if (prefix) {
      params.push(`${prefix}%`);
      whereClause += ` AND table_name ILIKE $${params.length}`;
    }

    params.push(lim);
    const limitParam = `$${params.length}`;

    const { rows } = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       ${whereClause}
       ORDER BY table_name
       LIMIT ${limitParam}`,
      params
    );

    const tableNames = rows.map((r) => r.table_name as string);
    const courseCodes = tableNames.map(formatTableNameAsCourseCode);

    return {
      tableNames,
      courseCodes,
      truncated: tableNames.length >= lim,
      limit: lim,
    };
  } finally {
    client.release();
  }
}

const MAX_RANK_UNION = 400;

/**
 * Rank course tables by overall average GPA (all rows in each table).
 * Optional filter by course number range (e.g. 400–499 for "400-level").
 */
export async function rankCoursesByAverageGpa(options: {
  tableNamePrefix: string;
  minCourseNumber?: number | null;
  maxCourseNumber?: number | null;
  topN?: number;
}) {
  const prefix = sanitizeTableNamePrefix(options.tableNamePrefix);
  if (!prefix) {
    return {
      error: "Invalid tableNamePrefix (e.g. CSCE or csce).",
      rankings: [] as Array<{
        table_name: string;
        course_code: string;
        avg_gpa: number | null;
        n_sections: number;
      }>,
    };
  }

  const topN = Math.min(Math.max(1, options.topN ?? 25), 100);

  const client = await pool.connect();
  try {
    const { rows: nameRows } = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name != 'professor'
         AND table_name ILIKE $1
       ORDER BY table_name`,
      [`${prefix}%`]
    );

    let tableNames: string[] = nameRows
      .map((r: { table_name: string }) => r.table_name)
      .filter(isSafeTableName);

    const minN = options.minCourseNumber ?? null;
    const maxN = options.maxCourseNumber ?? null;
    if (minN != null || maxN != null) {
      tableNames = tableNames.filter((t) => {
        const num = parseCourseNumberFromTableName(t);
        if (num == null) return false;
        if (minN != null && num < minN) return false;
        if (maxN != null && num > maxN) return false;
        return true;
      });
    }

    if (tableNames.length === 0) {
      return { rankings: [], note: "No matching course tables." };
    }

    const truncatedUnion = tableNames.length > MAX_RANK_UNION;
    const tables = truncatedUnion ? tableNames.slice(0, MAX_RANK_UNION) : tableNames;

    const unionParts = tables.map(
      (t) =>
        `SELECT '${t.replace(/'/g, "''")}'::text AS table_name, AVG(average_gpa)::numeric AS avg_gpa, COUNT(*)::int AS n_sections FROM ${t}`
    );

    const inner = unionParts.join(" UNION ALL ");
    const sql = `
      SELECT table_name, ROUND(avg_gpa::numeric, 3) AS avg_gpa, n_sections
      FROM (${inner}) AS per_course
      WHERE n_sections > 0 AND avg_gpa IS NOT NULL
      ORDER BY avg_gpa DESC NULLS LAST
      LIMIT $1
    `;

    const { rows } = await client.query(sql, [topN]);

    const rankings = rows.map(
      (r: { table_name: string; avg_gpa: string | number | null; n_sections: number }) => ({
        table_name: r.table_name,
        course_code: formatTableNameAsCourseCode(r.table_name),
        avg_gpa: r.avg_gpa != null ? Number(r.avg_gpa) : null,
        n_sections: r.n_sections,
      })
    );

    return {
      tableNamePrefix: prefix,
      minCourseNumber: minN,
      maxCourseNumber: maxN,
      rankings,
      truncatedTables: truncatedUnion,
      totalTablesScanned: tables.length,
    };
  } catch (e) {
    console.error("rankCoursesByAverageGpa:", e);
    return { error: String(e), rankings: [] };
  } finally {
    client.release();
  }
}

const MAX_COMPARE_COURSES = 15;

/**
 * Overall average GPA per course for an explicit list (not top-N within a department).
 * Use when the user names specific courses to compare; rankCoursesByAverageGpa omits courses outside its LIMIT.
 */
export async function compareCoursesOverallGpa(courses: string[]) {
  type Cmp = {
    requestedAs: string;
    course_code: string;
    avg_gpa: number | null;
    n_sections: number;
    error?: string;
  };

  const comparisons: Cmp[] = [];
  const client = await pool.connect();
  try {
    const uniq = [...new Set(courses.map((c) => c.trim()).filter(Boolean))].slice(
      0,
      MAX_COMPARE_COURSES
    );

    for (const raw of uniq) {
      const table = courseToTableName(raw);
      const course_code = formatTableNameAsCourseCode(table);

      if (!isSafeTableName(table)) {
        comparisons.push({
          requestedAs: raw,
          course_code,
          avg_gpa: null,
          n_sections: 0,
          error: "Invalid course code format",
        });
        continue;
      }

      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      if (exists.rows.length === 0) {
        comparisons.push({
          requestedAs: raw,
          course_code,
          avg_gpa: null,
          n_sections: 0,
          error: "No data table for this course",
        });
        continue;
      }

      try {
        const { rows } = await client.query<{
          avg_gpa: string | number | null;
          n_sections: string | number;
        }>(
          `SELECT ROUND(AVG(average_gpa)::numeric, 3) AS avg_gpa,
                  COUNT(*)::int AS n_sections
           FROM ${table}`
        );
        const r = rows[0];
        const nSections = r ? Number(r.n_sections) : 0;
        const avg =
          r?.avg_gpa != null && nSections > 0 ? Number(r.avg_gpa) : null;
        const row: Cmp = {
          requestedAs: raw,
          course_code,
          avg_gpa: avg,
          n_sections: nSections,
        };
        if (nSections === 0) {
          row.error = "No rows in course table";
        } else if (avg == null) {
          row.error = "No average_gpa values in rows";
        }
        comparisons.push(row);
      } catch (e) {
        console.error(`compareCoursesOverallGpa ${table}:`, e);
        comparisons.push({
          requestedAs: raw,
          course_code,
          avg_gpa: null,
          n_sections: 0,
          error: String(e),
        });
      }
    }

    comparisons.sort((a, b) => {
      if (a.avg_gpa == null && b.avg_gpa == null) return 0;
      if (a.avg_gpa == null) return 1;
      if (b.avg_gpa == null) return -1;
      return b.avg_gpa - a.avg_gpa;
    });

    return { comparisons };
  } finally {
    client.release();
  }
}

export async function findCoursesForInstructor(
  instructorPattern: string,
  department?: string
) {
  const client = await pool.connect();
  try {
    const { rows: allTables } = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name != 'professor'
       ORDER BY table_name`
    );

    let tableNames: string[] = allTables.map(
      (r: { table_name: string }) => r.table_name
    );

    if (department) {
      const prefix = department.toLowerCase().replace(/\s+/g, "");
      tableNames = tableNames.filter((t) => t.startsWith(prefix));
    }

    if (tableNames.length === 0) {
      return { instructor: instructorPattern, courses: [] };
    }

    const trimmed = instructorPattern.trim();
    const escaped = trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pattern = `%${escaped}%`;
    const commaKey = lastCommaInitialKey(trimmed);
    const whereInstructor = commaKey
      ? `(instructor ILIKE $1 OR strpos(lower(instructor), $2) > 0)`
      : `instructor ILIKE $1`;
    const unionParams = commaKey ? [pattern, commaKey] : [pattern];

    const unionParts = tableNames
      .filter((t) => isSafeTableName(t))
      .map(
        (t) =>
          `SELECT '${t}' AS course_table, instructor, COUNT(*) AS sections,
                  ROUND(AVG(average_gpa)::numeric, 2) AS avg_gpa
           FROM ${t}
           WHERE ${whereInstructor}
           GROUP BY instructor`
      );

    if (unionParts.length === 0) {
      return { instructor: instructorPattern, courses: [] };
    }

    const fullQuery = unionParts.join(" UNION ALL ") + " ORDER BY course_table";
    const { rows } = await client.query(fullQuery, unionParams);
    return { instructor: instructorPattern, courses: rows };
  } catch (e) {
    console.error("findCoursesForInstructor error:", e);
    return { instructor: instructorPattern, courses: [], error: String(e) };
  } finally {
    client.release();
  }
}

/**
 * Resolve professor rows for RMP lookup. Tries exact / ci-exact, then "LAST, F." key
 * (e.g. Teresa Leyk -> leyk, t), then token-and fallback.
 */
export async function fetchRmpLinksForInstructors(names: string[]) {
  if (!names.length) return { links: [] as { instructor: string; rmp_link: string | null }[] };
  const client = await pool.connect();
  try {
    const out: { instructor: string; rmp_link: string | null }[] = [];
    const seen = new Set<string>();

    for (const raw of names) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      let rows: { instructor: string; rmp_link: string | null }[] = [];

      const exact = await client.query<{
        instructor: string;
        rmp_link: string | null;
      }>(
        `SELECT instructor, rmp_link FROM professor WHERE instructor = $1 LIMIT 8`,
        [trimmed]
      );
      rows = exact.rows;

      if (rows.length === 0) {
        const ciExact = await client.query<{
          instructor: string;
          rmp_link: string | null;
        }>(
          `SELECT instructor, rmp_link FROM professor
           WHERE lower(trim(instructor)) = lower(trim($1))
           LIMIT 8`,
          [trimmed]
        );
        rows = ciExact.rows;
      }

      if (rows.length === 0) {
        const commaKey = lastCommaInitialKey(trimmed);
        if (commaKey) {
          const byKey = await client.query<{
            instructor: string;
            rmp_link: string | null;
          }>(
            `SELECT instructor, rmp_link FROM professor
             WHERE strpos(lower(instructor), $1) > 0
             ORDER BY char_length(instructor) ASC
             LIMIT 12`,
            [commaKey]
          );
          rows = byKey.rows;
        }
      }

      if (rows.length === 0) {
        const tokens = professorNameTokens(trimmed);

        if (tokens.length > 0) {
          const cond = tokens
            .map((_, i) => `strpos(lower(instructor), $${i + 1}) > 0`)
            .join(" AND ");
          const orderRank =
            tokens.length >= 2
              ? `ORDER BY CASE WHEN strpos(lower(instructor), $1) > 0 THEN 0 ELSE 1 END, char_length(instructor) ASC`
              : `ORDER BY char_length(instructor) ASC`;
          const fuzzy = await client.query<{
            instructor: string;
            rmp_link: string | null;
          }>(
            `SELECT instructor, rmp_link FROM professor
             WHERE ${cond}
             ${orderRank}
             LIMIT 12`,
            tokens
          );
          rows = fuzzy.rows;
        }
      }

      for (const row of rows) {
        if (seen.has(row.instructor)) continue;
        seen.add(row.instructor);
        out.push(row);
      }
    }

    return { links: out };
  } finally {
    client.release();
  }
}
