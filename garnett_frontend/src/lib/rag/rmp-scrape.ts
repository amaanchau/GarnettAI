import axios from "axios";
import * as cheerio from "cheerio";
import { getCachedRmpData, setCachedRmpData, getCacheStats } from "./rmp-cache";

const headers = { "User-Agent": "Mozilla/5.0" };

export async function scrapeRmpProfessors(
  urls: (string | null | undefined)[]
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  let cacheHits = 0;
  let cacheMisses = 0;
  const urlsToScrape: string[] = [];

  for (const url of urls) {
    if (!url) continue;
    const profId = url.split("/").pop() as string;
    const cachedData = getCachedRmpData(profId);
    if (cachedData) {
      results[profId] = cachedData;
      cacheHits++;
    } else {
      urlsToScrape.push(url);
      cacheMisses++;
    }
  }

  if (urlsToScrape.length === 0) {
    return results;
  }

  const CONCURRENCY_LIMIT = 3;
  const scrapingStartTime = Date.now();

  const scrapeSingleProfessor = async (url: string) => {
    const profId = url.split("/").pop() as string;
    try {
      const res = await axios.get(url, { headers, timeout: 8000 });
      const $ = cheerio.load(res.data);

      const professorData: Record<string, unknown> = {
        id: profId,
        name: $(".NameTitle__Name-dowf0z-0").text().trim() || `Professor ${profId}`,
        url,
        rating: $(".RatingValue__Numerator-qw8sqy-2").text().trim() || "N/A",
        total_ratings: $(".RatingValue__NumRatings-qw8sqy-0 a").text().replace(/\xa0/g, " ").trim() || "N/A",
        would_take_again: $(".FeedbackItem__FeedbackNumber-uof32n-1").eq(0).text().trim() || "N/A",
        difficulty: $(".FeedbackItem__FeedbackNumber-uof32n-1").eq(1).text().trim() || "N/A",
        top_tags: [...new Set($(".Tag-bs9vf4-0").map((_, el) => $(el).text().trim()).get())],
      };

      const professor_attendance_stats: Record<string, number> = {};
      const professor_textbook_stats: Record<string, number> = {};

      $('[class*="MetaItem__StyledMetaItem"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes("Attendance")) {
          const spans = $(el).find("span");
          if (spans.length > 0) {
            const val = spans.last().text().trim();
            professor_attendance_stats[val] = (professor_attendance_stats[val] || 0) + 1;
          }
        }
        if (text.includes("Textbook")) {
          const spans = $(el).find("span");
          if (spans.length > 0) {
            const val = spans.last().text().trim();
            professor_textbook_stats[val] = (professor_textbook_stats[val] || 0) + 1;
          }
        }
      });

      if (
        Object.keys(professor_attendance_stats).length === 0 &&
        Object.keys(professor_textbook_stats).length === 0
      ) {
        const html = $.html();
        for (const match of html.matchAll(/Attendance"[^<>]*<[^<>]*span[^<>]*>([^<>]+)<\/span>/g)) {
          const val = match[1].trim();
          professor_attendance_stats[val] = (professor_attendance_stats[val] || 0) + 1;
        }
        for (const match of html.matchAll(/Textbook"[^<>]*<[^<>]*span[^<>]*>([^<>]+)<\/span>/g)) {
          const val = match[1].trim();
          professor_textbook_stats[val] = (professor_textbook_stats[val] || 0) + 1;
        }
      }

      professorData.attendance_stats = professor_attendance_stats;
      professorData.textbook_stats = professor_textbook_stats;

      setCachedRmpData(profId, professorData);
      return { profId, data: professorData };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const errorData = { error: msg };
      setCachedRmpData(profId, errorData);
      return { profId, data: errorData };
    }
  };

  for (let i = 0; i < urlsToScrape.length; i += CONCURRENCY_LIMIT) {
    const chunk = urlsToScrape.slice(i, i + CONCURRENCY_LIMIT);
    const chunkResults = await Promise.all(chunk.map(scrapeSingleProfessor));
    chunkResults.forEach(({ profId, data }) => {
      results[profId] = data;
    });
    if (i + CONCURRENCY_LIMIT < urlsToScrape.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`RMP scraping done in ${Date.now() - scrapingStartTime}ms`, getCacheStats());
  return results;
}
