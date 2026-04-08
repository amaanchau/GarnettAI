import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ professors: [] });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Database connection string is missing" },
        { status: 500 }
      );
    }

    const sql = neon(process.env.DATABASE_URL);
    const trimmed = query.trim();
    const pattern = `%${trimmed.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const rows = await sql`
      SELECT instructor, department, rmp_link
      FROM professor
      WHERE instructor ILIKE ${pattern}
      ORDER BY char_length(instructor) ASC, instructor ASC
      LIMIT 10
    `;

    const professors = rows.map((r) => ({
      instructor: r.instructor as string,
      department: r.department as string | null,
      rmp_link: r.rmp_link as string | null,
    }));

    return NextResponse.json({ professors });
  } catch (error) {
    console.error("Error searching professors:", error);
    return NextResponse.json(
      {
        error: "Failed to search professors",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
