// pages/api/answerWithRag.js
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import * as cheerio from 'cheerio';
import axios from 'axios';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const extractCourseAndProfessor = (query) => {
  const match = query.toUpperCase().match(/([A-Z]{2,4})[\s-]?([0-9]{3})/);
  return match ? `${match[1]} ${match[2]}` : null;
};

const fetchCourseInfo = async (course) => {
  const table = course.toLowerCase().replace(' ', '');
  const client = await pool.connect();
  try {
    const perTermQuery = `
      SELECT instructor, term, COUNT(*) AS num_sections_in_term,
             ROUND(AVG(average_gpa)::numeric, 3) AS avg_gpa_in_term
      FROM ${table}
      GROUP BY instructor, term
      ORDER BY instructor, term;
    `;
    const overallQuery = `
      SELECT instructor, COUNT(*) AS total_sections,
             ROUND(AVG(average_gpa)::numeric, 3) AS overall_avg_gpa
      FROM ${table}
      GROUP BY instructor
      ORDER BY overall_avg_gpa DESC;
    `;

    const perTerm = (await client.query(perTermQuery)).rows;
    const overall = (await client.query(overallQuery)).rows;
    return { per_term: perTerm, overall };
  } finally {
    client.release();
  }
};

const fetchProfInfo = async (overall) => {
  const profNames = overall.map((row) => row.instructor);
  const client = await pool.connect();
  try {
    const placeholders = profNames.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT instructor, rmp_link
      FROM professor
      WHERE instructor IN (${placeholders})
    `;
    const { rows } = await client.query(query, profNames);
    const links = rows.map((row) => row.rmp_link);
    return await scrapeRmpProfessors(links);
  } finally {
    client.release();
  }
};

const scrapeRmpProfessors = async (urls) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0',
    };
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
  
        // Fallback using regex if nothing found
        if (
          Object.keys(professor_attendance_stats).length === 0 &&
          Object.keys(professor_textbook_stats).length === 0
        ) {
          const html = $.html();
  
          const attendanceMatches = [...html.matchAll(/Attendance"[^<>]*<[^<>]*span[^<>]*>([^<>]+)<\/span>/g)];
          attendanceMatches.forEach((match) => {
            const val = match[1].trim();
            professor_attendance_stats[val] = (professor_attendance_stats[val] || 0) + 1;
          });
  
          const textbookMatches = [...html.matchAll(/Textbook"[^<>]*<[^<>]*span[^<>]*>([^<>]+)<\/span>/g)];
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
  

const buildPrompt = (query, courseInfo, profInfo) => {
  return `You are a helpful Texas A&M course advisor. User question: "${query}".
USE THE GPA DATA FROM Course information: ${JSON.stringify(courseInfo)}, and the RateMyProfessor information: ${JSON.stringify(profInfo)}, to tailor more detailed responses.
Make you're response Aggie themed and in a readable format with emojis.
DO NOT just spit out the data you recieve, synthesize and understand the data so that you can form descriptive reccomendations for professors/classes.
unless asked, DO NOT give any links and keep the answer consice.`;
};

const answerWithRag = async (query) => {
  const course = extractCourseAndProfessor(query);
  if (!course) return "Howdy! Please include a course name in your prompt (ex: CSCE 221).";

  const courseInfo = await fetchCourseInfo(course);
  const profInfo = await fetchProfInfo(courseInfo.overall);
  const prompt = buildPrompt(query, courseInfo, profInfo);

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
};

export async function POST(req) {
    try {
      const body = await req.json();
      const query = body.query;
  
      if (!query) {
        return Response.json({ error: 'Missing query' }, { status: 400 });
      }
  
      const answer = await answerWithRag(query);
      return Response.json({ answer });
    } catch (error) {
      console.error('[RAG Error]', error);
      return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
  }
  