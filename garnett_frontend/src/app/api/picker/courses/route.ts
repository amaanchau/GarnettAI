import { NextResponse } from "next/server";
import { listAllCourseCodes } from "@/lib/rag/prefetch";

export async function GET() {
  try {
    const codes = await listAllCourseCodes();
    return NextResponse.json({ courses: codes });
  } catch (error) {
    console.error("GET /api/picker/courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
