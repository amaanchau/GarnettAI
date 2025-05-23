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

// Function to extract multiple courses from a query
const extractCoursesAndProfessors = (query) => {
  // Regular expression to find course codes like CSCE 221, MATH 151, etc.
  // This matches uppercase letters followed by numbers, with optional space between
  const courseRegex = /([A-Z]{2,4})[\s-]?([0-9]{3})/g;
  
  // Find all matches in the query
  const matches = [...query.toUpperCase().matchAll(courseRegex)];
  
  // If no matches, return empty array
  if (!matches || matches.length === 0) {
    return [];
  }
  
  // Format and return all found courses
  const courses = matches.map(match => `${match[1]} ${match[2]}`);
  
  // Return unique courses (in case the same course is mentioned multiple times)
  return [...new Set(courses)];
};

// Backward compatibility function for single course extraction
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const extractCourseAndProfessor = (query) => {
  const courses = extractCoursesAndProfessors(query);
  return courses.length > 0 ? courses[0] : null;
};

// Check if a course exists in the database
const checkCourseExists = async (course) => {
  const table = course.toLowerCase().replace(' ', '');
  const client = await pool.connect();
  try {
    // Check if table exists in the database
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = $1
      )
    `;
    const { rows } = await client.query(query, [table]);
    return rows[0].exists;
  } finally {
    client.release();
  }
};

const fetchCourseInfo = async (course) => {
  const table = course.toLowerCase().replace(' ', '');
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
    
    // Create an overall array with just instructors for backwards compatibility
    const instructorSet = new Set();
    perTerm.forEach(row => instructorSet.add(row.instructor));
    const overall = Array.from(instructorSet).map(instructor => {
      return { instructor };
    });
    
    return { per_term: perTerm, overall };
  } catch (error) {
    console.error(`Error fetching course info for ${course}:`, error);
    return { per_term: [], overall: [] };
  } finally {
    client.release();
  }
};

const fetchProfInfo = async (overall) => {
  if (!overall || overall.length === 0) {
    return {};
  }
  
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
  } catch (error) {
    console.error('Error fetching professor info:', error);
    return {};
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
    if (!url) continue;
    
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

// Updated prompt building function for multiple courses
const buildPromptWithMultiCourses = (query, conversationHistory, courseDataMap, profDataMap, sessionContext) => {
  // Format conversation history
  const formattedHistory = conversationHistory
    .map((msg) => `${msg.isUser ? 'User' : 'AI'}: ${msg.content}`)
    .join('\n\n');

  // Format context information
  let contextInfo = '';
  if (sessionContext.activeCourses && sessionContext.activeCourses.length > 0) {
    if (sessionContext.activeCourses.length === 1) {
      contextInfo = `\nThe current course in this conversation is: ${sessionContext.activeCourses[0]}`;
    } else {
      contextInfo = `\nThe active courses in this conversation are: ${sessionContext.activeCourses.join(', ')}`;
    }
  }

  // Format course data for all courses
  const courseDataString = JSON.stringify(courseDataMap);
  const profDataString = JSON.stringify(profDataMap);

  return `You are a helpful Texas A&M course advisor. 

Previous conversation:
${formattedHistory}
${contextInfo}

Current user question: "${query}"

USE THE GPA DATA FROM Course information: ${courseDataString}, and the RateMyProfessor information: ${profDataString}, to tailor detailed responses.
CRITICALLY IMPORTANT: When users ask about the "easiest" professor or class:
1. First compare by average GPA - professors with higher GPAs should typically rank higher
2. When GPAs are within 0.2 points of each other, use RateMyProfessor ratings to determine the ranking
3. Present information in conversational, flowing paragraphs rather than lists
4. Synthesize the GPA data, term information, and RateMyProfessor feedback (ratings, difficulty, tags) into cohesive descriptions
5. Recommend the professor who offers the best balance of high GPA and positive RateMyProfessor feedback

If the user is comparing multiple courses, provide information about all requested courses.
Make your response Aggie themed and in a readable format with emojis.
DO NOT just spit out the data you receive, synthesize and understand the data so that you can form descriptive recommendations for professors/classes.
Unless asked, DO NOT give any links and keep the answer concise.`;
};

const answerWithRag = async (query, conversationHistory = [], sessionContext = null) => {
  // Extract all courses from the query
  const coursesInQuery = extractCoursesAndProfessors(query);
  
  // Determine which courses to use
  let coursesToUse = [];
  
  if (coursesInQuery.length > 0) {
    // Use courses from current query
    coursesToUse = coursesInQuery;
  } else if (sessionContext?.activeCourses?.length > 0) {
    // Fall back to context if no courses in query
    coursesToUse = sessionContext.activeCourses;
  }
  
  // If no courses found anywhere, ask for one
  if (coursesToUse.length === 0) {
    return {
      answer: "Howdy! Please include a course name in your prompt (ex: CSCE 221) so I can help you better.",
      sessionContext: { currentCourse: null, activeCourses: [] }
    };
  }

  // Check if all courses exist
  const invalidCourses = [];
  for (const course of coursesToUse) {
    const exists = await checkCourseExists(course);
    if (!exists) {
      invalidCourses.push(course);
    }
  }
  
  // If any invalid courses, return helpful message
  if (invalidCourses.length > 0) {
    if (invalidCourses.length === coursesToUse.length) {
      // All courses are invalid
      const courseString = invalidCourses.length === 1 
        ? invalidCourses[0] 
        : invalidCourses.join(', ');
      
      return {
        answer: `Howdy! I don't have any data for ${courseString}. This might not be a valid Texas A&M course code, or we haven't loaded this course's data yet. Please check the course code and try again, or ask about a different course.`,
        sessionContext: { 
          currentCourse: null,
          activeCourses: coursesToUse.filter(course => !invalidCourses.includes(course))
        }
      };
    } else {
      // Some courses are valid, some invalid
      const validCourses = coursesToUse.filter(course => !invalidCourses.includes(course));
      const invalidString = invalidCourses.join(', ');
      
      return {
        answer: `Howdy! I don't have any data for ${invalidString}. I'll answer based on the other course(s) you mentioned.`,
        sessionContext: { 
          currentCourse: validCourses[0],
          activeCourses: validCourses
        }
      };
    }
  }

  // For backward compatibility and UI indicators
  const primaryCourse = coursesToUse[0]; 
  
  // Fetch course data for all courses to use
  const courseData = {};
  const profData = {};
  
  try {
    for (const course of coursesToUse) {
      const courseInfo = await fetchCourseInfo(course);
      courseData[course] = courseInfo;
      
      const profInfo = await fetchProfInfo(courseInfo.overall);
      profData[course] = profInfo;
    }
    
    // Build prompt with conversation history and context
    const prompt = buildPromptWithMultiCourses(
      query, 
      conversationHistory, 
      courseData, 
      profData, 
      { 
        currentCourse: primaryCourse, 
        activeCourses: coursesToUse 
      }
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      answer: response.choices[0].message.content,
      sessionContext: { 
        currentCourse: primaryCourse,
        activeCourses: coursesToUse 
      }
    };
  } catch (error) {
    console.error('[API Error]', error);
    return {
      answer: "Whoop! We're having trouble processing your request. Please try again in a few moments.",
      sessionContext: { 
        currentCourse: primaryCourse,
        activeCourses: coursesToUse 
      }
    };
  }
};

export async function POST(req) {
  try {
    const body = await req.json();
    const query = body.query;
    const conversationHistory = body.conversationHistory || [];
    const sessionContext = body.sessionContext || { currentCourse: null, activeCourses: [] };

    if (!query) {
      return Response.json({ error: 'Missing query' }, { status: 400 });
    }

    const result = await answerWithRag(query, conversationHistory, sessionContext);
    
    return Response.json({
      answer: result.answer,
      sessionContext: result.sessionContext
    });
  } catch (error) {
    console.error('[RAG Error]', error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}