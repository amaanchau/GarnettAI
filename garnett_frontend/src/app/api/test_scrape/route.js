import * as cheerio from 'cheerio';
import axios from 'axios';

const headers = {
  'User-Agent': 'Mozilla/5.0',
};

const testUrls = [
  'https://www.ratemyprofessors.com/professor/2619048',
  'https://www.ratemyprofessors.com/professor/609101',
];

const scrapeRmpProfessors = async (urls) => {
  const results = {};

  for (const url of urls) {
    const profId = url.split('/').pop();
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const professorData = {
        id: profId,
        name: $('.NameTitle__Name-dowf0z-0').text().trim() || `Professor ${profId}`,
        url,
        rating: $('.RatingValue__Numerator-qw8sqy-2').text().trim() || 'N/A',
        total_ratings: $('.RatingValue__NumRatings-qw8sqy-0 a').text().replace(/\xa0/g, ' ').trim() || 'N/A',
        would_take_again: $('.FeedbackItem__FeedbackNumber-uof32n-1').eq(0).text().trim() || 'N/A',
        difficulty: $('.FeedbackItem__FeedbackNumber-uof32n-1').eq(1).text().trim() || 'N/A',
        top_tags: [...new Set($('.Tag-bs9vf4-0').map((_, el) => $(el).text().trim()).get())],
      };

      // Attendance & Textbook Stats
      const professor_attendance_stats = {};
      const professor_textbook_stats = {};

      const metaItems = $('[class*="MetaItem__StyledMetaItem"]');
      metaItems.each((_, el) => {
        const text = $(el).text().trim();

        if (text.includes('Attendance')) {
          const spans = $(el).find('span');
          if (spans.length > 0) {
            const val = spans.last().text().trim();
            professor_attendance_stats[val] = (professor_attendance_stats[val] || 0) + 1;
          }
        }

        if (text.includes('Textbook')) {
          const spans = $(el).find('span');
          if (spans.length > 0) {
            const val = spans.last().text().trim();
            professor_textbook_stats[val] = (professor_textbook_stats[val] || 0) + 1;
          }
        }
      });

      // Fallback: use regex on HTML if nothing was found
      if (
        Object.keys(professor_attendance_stats).length === 0 &&
        Object.keys(professor_textbook_stats).length === 0
      ) {
        const html = $.html();

        const attendanceMatches = [
          ...html.matchAll(/Attendance"[^<>]*<[^<>]*span[^<>]*>([^<>]+)<\/span>/g),
        ];
        attendanceMatches.forEach((match) => {
          const val = match[1].trim();
          professor_attendance_stats[val] = (professor_attendance_stats[val] || 0) + 1;
        });

        const textbookMatches = [
          ...html.matchAll(/Textbook"[^<>]*<[^<>]*span[^<>]*>([^<>]+)<\/span>/g),
        ];
        textbookMatches.forEach((match) => {
          const val = match[1].trim();
          professor_textbook_stats[val] = (professor_textbook_stats[val] || 0) + 1;
        });
      }

      professorData.attendance_stats = professor_attendance_stats;
      professorData.textbook_stats = professor_textbook_stats;

      results[profId] = professorData;

      await new Promise((r) => setTimeout(r, 500)); // Be nice to RMP
    } catch (e) {
      results[profId] = { error: e.message };
    }
  }

  return results;
};

export async function GET() {
  try {
    const data = await scrapeRmpProfessors(testUrls);
    return Response.json({ data });
  } catch (e) {
    console.error('Scrape failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
