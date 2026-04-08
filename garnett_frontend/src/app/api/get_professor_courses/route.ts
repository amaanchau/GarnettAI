import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/rag/db-pool";

export async function GET(req: NextRequest) {
  const instructor = req.nextUrl.searchParams.get("instructor");

  if (!instructor) {
    return NextResponse.json(
      { error: "Missing instructor parameter" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const pattern = `%${instructor.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const { rows: profRows } = await client.query(
      `SELECT instructor, rmp_link, department, course_tables
       FROM professor
       WHERE instructor ILIKE $1
       ORDER BY char_length(instructor) ASC
       LIMIT 1`,
      [pattern]
    );

    if (profRows.length === 0) {
      return NextResponse.json({ instructor, rmp_link: null, department: null, courses: [] });
    }

    const prof = profRows[0];
    const matchedName = prof.instructor as string;
    const rmpLink = prof.rmp_link as string | null;
    const department = prof.department as string | null;
    const courseTables: string[] = (prof.course_tables as string[]) || [];

    if (courseTables.length === 0) {
      return NextResponse.json({ instructor: matchedName, rmp_link: rmpLink, department, courses: [] });
    }

    // Only scan the tables we already know this professor appears in
    const safeTables = courseTables.filter((t) => /^[a-z0-9]+$/.test(t));

    const unionParts = safeTables.map(
      (t) =>
        `SELECT '${t.replace(/'/g, "''")}'::text AS course_table,
                instructor,
                COUNT(*)::int AS sections_count,
                COUNT(DISTINCT term)::int AS terms_count,
                MAX(term) AS latest_term,
                ROUND(AVG(average_gpa)::numeric, 3) AS avg_gpa,
                SUM(a)::int AS total_a,
                SUM(b)::int AS total_b,
                SUM(c)::int AS total_c,
                SUM(d)::int AS total_d,
                SUM(f)::int AS total_f,
                SUM(total)::int AS total_students
         FROM ${t}
         WHERE instructor = $1
         GROUP BY instructor
         HAVING COUNT(*) > 0`
    );

    const fullQuery = unionParts.join(" UNION ALL ") + " ORDER BY course_table";
    const { rows } = await client.query(fullQuery, [matchedName]);

    const courses = rows.map((r) => {
      const tableName = r.course_table as string;
      const m = tableName.match(/^([a-z]+)(\d+)$/i);
      const courseCode = m
        ? `${m[1].toUpperCase()} ${m[2]}`
        : tableName.toUpperCase();

      return {
        course: courseCode,
        table_name: tableName,
        instructor: r.instructor,
        avg_gpa: r.avg_gpa != null ? Number(r.avg_gpa) : null,
        sections_count: Number(r.sections_count),
        terms_count: Number(r.terms_count),
        latest_term: r.latest_term,
        total_students: Number(r.total_students),
        total_a: Number(r.total_a),
        total_b: Number(r.total_b),
        total_c: Number(r.total_c),
        total_d: Number(r.total_d),
        total_f: Number(r.total_f),
      };
    });

    return NextResponse.json({
      instructor: matchedName,
      rmp_link: rmpLink,
      department,
      courses,
    });
  } catch (error) {
    console.error("Error fetching professor courses:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch professor courses",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
