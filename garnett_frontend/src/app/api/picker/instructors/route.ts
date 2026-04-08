import { NextResponse } from "next/server";
import { listInstructorsForCourse } from "@/lib/rag/prefetch";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const course = searchParams.get("course");
  if (!course) {
    return NextResponse.json(
      { error: "Missing course query param" },
      { status: 400 }
    );
  }
  try {
    const instructors = await listInstructorsForCourse(course);
    return NextResponse.json({ course, instructors });
  } catch (error) {
    console.error("GET /api/picker/instructors:", error);
    return NextResponse.json(
      { error: "Failed to fetch instructors" },
      { status: 500 }
    );
  }
}
