import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !url.includes("ratemyprofessors.com")) {
    return NextResponse.json(
      { error: "Missing or invalid RMP URL" },
      { status: 400 }
    );
  }

  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000,
    });
    const $ = cheerio.load(res.data);

    const rating =
      $(".RatingValue__Numerator-qw8sqy-2").text().trim() || "N/A";
    const totalRatings =
      $(".RatingValue__NumRatings-qw8sqy-0 a")
        .text()
        .replace(/\xa0/g, " ")
        .trim() || "N/A";
    const feedbackNumbers = $(".FeedbackItem__FeedbackNumber-uof32n-1");
    const wouldTakeAgain = feedbackNumbers.eq(0).text().trim() || "N/A";
    const difficulty = feedbackNumbers.eq(1).text().trim() || "N/A";
    const topTags = [
      ...new Set(
        $(".Tag-bs9vf4-0")
          .map((_, el) => $(el).text().trim())
          .get()
      ),
    ].slice(0, 8);

    return NextResponse.json({
      rating,
      total_ratings: totalRatings,
      would_take_again: wouldTakeAgain,
      difficulty,
      top_tags: topTags,
      url,
    });
  } catch (error) {
    console.error("Error scraping RMP profile:", error);
    return NextResponse.json({
      error: "Could not load RMP profile",
      url,
    });
  }
}
