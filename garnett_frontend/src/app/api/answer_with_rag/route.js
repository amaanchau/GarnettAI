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

// In-memory cache for RateMyProfessor data
const rmpCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 1500; // Maximum number of professors to cache (~6MB memory)

// Cache helper functions
const getCachedRmpData = (profId) => {
  const cached = rmpCache.get(profId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`Cache hit for professor ${profId}`);
    
    // Move to end for LRU (Least Recently Used) tracking
    rmpCache.delete(profId);
    rmpCache.set(profId, cached);
    
    return cached.data;
  }
  if (cached) {
    console.log(`Cache expired for professor ${profId}`);
    rmpCache.delete(profId); // Clean up expired entries
  }
  return null;
};

const setCachedRmpData = (profId, data) => {
  // If cache is at max size, remove the oldest entry (LRU eviction)
  if (rmpCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = rmpCache.keys().next().value;
    rmpCache.delete(oldestKey);
    console.log(`Cache evicted oldest entry: ${oldestKey} (cache full at ${MAX_CACHE_SIZE})`);
  }
  
  rmpCache.set(profId, {
    data,
    timestamp: Date.now()
  });
  console.log(`Cached data for professor ${profId} (cache size: ${rmpCache.size}/${MAX_CACHE_SIZE})`);
};

// Cache stats for monitoring
const getCacheStats = () => {
  const now = Date.now();
  let expired = 0;
  let valid = 0;
  
  for (const [, cached] of rmpCache.entries()) {
    if (now - cached.timestamp > CACHE_DURATION) {
      expired++;
    } else {
      valid++;
    }
  }
  
  return {
    size: rmpCache.size,
    maxSize: MAX_CACHE_SIZE,
    valid,
    expired,
    utilizationPercent: Math.round((rmpCache.size / MAX_CACHE_SIZE) * 100),
    entries: Array.from(rmpCache.keys()).slice(0, 10) // Show first 10 for debugging
  };
};

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

// Batch check if multiple courses exist in the database (more efficient)
const checkMultipleCoursesExist = async (courses) => {
  if (!courses || courses.length === 0) return {};
  
  const tables = courses.map(course => course.toLowerCase().replace(' ', ''));
  const client = await pool.connect();
  try {
    const placeholders = tables.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN (${placeholders})
    `;
    const { rows } = await client.query(query, tables);
    const existingTables = new Set(rows.map(row => row.table_name));
    
    const results = {};
    courses.forEach(course => {
      const table = course.toLowerCase().replace(' ', '');
      results[course] = existingTables.has(table);
    });
    
    return results;
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
  let cacheHits = 0;
  let cacheMisses = 0;

  console.log(`Processing ${urls.length} professor URLs`);

  // First, quickly check cache for all URLs
  const urlsToScrape = [];
  for (const url of urls) {
    if (!url) continue;
    
    const profId = url.split('/').pop();
    
    // Check cache first
    const cachedData = getCachedRmpData(profId);
    if (cachedData) {
      results[profId] = cachedData;
      cacheHits++;
    } else {
      urlsToScrape.push(url);
      cacheMisses++;
    }
  }

  console.log(`Cache check complete: ${cacheHits} cache hits, ${cacheMisses} URLs need scraping`);

  if (urlsToScrape.length === 0) {
    console.log('All data available from cache!');
    return results;
  }

  // Scrape remaining URLs in parallel with controlled concurrency
  const CONCURRENCY_LIMIT = 3; // Don't overwhelm RMP servers
  console.log(`Starting parallel scraping of ${urlsToScrape.length} URLs with concurrency limit of ${CONCURRENCY_LIMIT}`);
  
  const scrapingStartTime = Date.now();

  // Helper function to scrape a single professor
  const scrapeSingleProfessor = async (url) => {
    const profId = url.split('/').pop();
    console.log(`Scraping fresh data for professor ${profId}`);
    
    try {
      const res = await axios.get(url, { 
        headers,
        timeout: 8000 // Reduced timeout for faster failures
      });
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

      // Cache the scraped data
      setCachedRmpData(profId, professorData);
      console.log(`Successfully scraped professor ${profId}`);
      
      return { profId, data: professorData };
    } catch (e) {
      const errorData = { error: e.message };
      // Cache errors too to avoid repeated failed requests
      setCachedRmpData(profId, errorData);
      console.error(`Error scraping professor ${profId}:`, e.message);
      return { profId, data: errorData };
    }
  };

  // Process URLs in batches with controlled concurrency
  const chunks = [];
  for (let i = 0; i < urlsToScrape.length; i += CONCURRENCY_LIMIT) {
    chunks.push(urlsToScrape.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing batch ${i + 1}/${chunks.length} (${chunk.length} URLs)`);
    
    const chunkPromises = chunk.map(scrapeSingleProfessor);
    const chunkResults = await Promise.all(chunkPromises);
    
    // Store results
    chunkResults.forEach(({ profId, data }) => {
      results[profId] = data;
    });

    // Small delay between batches to be respectful to RMP
    if (i < chunks.length - 1) {
      console.log('Waiting 300ms before next batch...');
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const scrapingTime = Date.now() - scrapingStartTime;
  console.log(`RMP scraping complete in ${scrapingTime}ms: ${cacheHits} cache hits, ${cacheMisses} cache misses`);
  console.log(`Average time per scraped professor: ${Math.round(scrapingTime / cacheMisses)}ms`);
  console.log(`Cache stats:`, getCacheStats());

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

// Streaming version of answerWithRag
const answerWithRagStreaming = async (query, conversationHistory = [], sessionContext = null, controller, encoder, requestStartTime) => {
  const sendUpdate = (type, data) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
  };

  // Extract all courses from the query
  const coursesInQuery = extractCoursesAndProfessors(query);
  
  // Determine which courses to use
  let coursesToUse = [];
  
  if (coursesInQuery.length > 0) {
    coursesToUse = coursesInQuery;
  } else if (sessionContext?.activeCourses?.length > 0) {
    coursesToUse = sessionContext.activeCourses;
  }
  
  if (coursesToUse.length === 0) {
    sendUpdate('complete', {
      answer: "Howdy! Please include a course name in your prompt (ex: CSCE 221) so I can help you better.",
      sessionContext: { currentCourse: null, activeCourses: [] },
      _metadata: { responseTime: Date.now() - requestStartTime }
    });
    return;
  }

  sendUpdate('status', { 
    message: `Found courses: ${coursesToUse.join(', ')}. Checking availability...`, 
    progress: 10 
  });

  // Check if all courses exist (single optimized query)
  console.log('Checking course existence with batch query...');
  const courseExistsStartTime = Date.now();
  
  const existenceResults = await checkMultipleCoursesExist(coursesToUse);
  const invalidCourses = coursesToUse.filter(course => !existenceResults[course]);
    
  console.log(`Course existence check completed in ${Date.now() - courseExistsStartTime}ms`);
  
  if (invalidCourses.length > 0) {
    if (invalidCourses.length === coursesToUse.length) {
      const courseString = invalidCourses.length === 1 
        ? invalidCourses[0] 
        : invalidCourses.join(', ');
      
      sendUpdate('complete', {
        answer: `Howdy! I don't have any data for ${courseString}. This might not be a valid Texas A&M course code, or we haven't loaded this course's data yet. Please check the course code and try again, or ask about a different course.`,
        sessionContext: { 
          currentCourse: null,
          activeCourses: coursesToUse.filter(course => !invalidCourses.includes(course))
        },
        _metadata: { responseTime: Date.now() - requestStartTime }
      });
      return;
    } else {
      const validCourses = coursesToUse.filter(course => !invalidCourses.includes(course));
      const invalidString = invalidCourses.join(', ');
      
      sendUpdate('complete', {
        answer: `Howdy! I don't have any data for ${invalidString}. I'll answer based on the other course(s) you mentioned.`,
        sessionContext: { 
          currentCourse: validCourses[0],
          activeCourses: validCourses
        },
        _metadata: { responseTime: Date.now() - requestStartTime }
      });
      return;
    }
  }

  const primaryCourse = coursesToUse[0]; 
  
  sendUpdate('status', { 
    message: 'Collecting course and professor data...', 
    progress: 20 
  });

  const courseData = {};
  const profData = {};
  
  try {
    console.log(`Processing ${coursesToUse.length} courses in parallel:`, coursesToUse);
    const startTime = Date.now();
    
    // Step 1: Fetch all course info in parallel
    console.log('Step 1: Fetching course info for all courses in parallel...');
    const courseInfoPromises = coursesToUse.map(async (course) => {
      const courseStartTime = Date.now();
      console.log(`Fetching course info for ${course}`);
      
      const courseInfo = await fetchCourseInfo(course);
      console.log(`Course info for ${course} fetched in ${Date.now() - courseStartTime}ms`);
      
      return { course, courseInfo };
    });
    
    const courseResults = await Promise.all(courseInfoPromises);
    
    courseResults.forEach(({ course, courseInfo }) => {
      courseData[course] = courseInfo;
    });
    
    const courseInfoTime = Date.now() - startTime;
    console.log(`All course info fetched in ${courseInfoTime}ms`);
    
    sendUpdate('status', { 
      message: 'Course data collected. Gathering professor reviews...', 
      progress: 40 
    });
    
    // Step 2: Fetch all professor info in parallel
    console.log('Step 2: Fetching professor info for all courses in parallel...');
    const profInfoStartTime = Date.now();
    
    const profInfoPromises = courseResults.map(async ({ course, courseInfo }) => {
      const profStartTime = Date.now();
      console.log(`Fetching professor info for ${course} (${courseInfo.overall.length} professors)`);
      
      const profInfo = await fetchProfInfo(courseInfo.overall);
      console.log(`Professor info for ${course} fetched in ${Date.now() - profStartTime}ms`);
      
      return { course, profInfo };
    });
    
    const profResults = await Promise.all(profInfoPromises);
    
    profResults.forEach(({ course, profInfo }) => {
      profData[course] = profInfo;
    });
    
    const profInfoTime = Date.now() - profInfoStartTime;
    console.log(`All professor info fetched in ${profInfoTime}ms`);
    console.log(`Total data fetching completed in ${Date.now() - startTime}ms (Course Info: ${courseInfoTime}ms, Prof Info: ${profInfoTime}ms)`);
    
    sendUpdate('status', { 
      message: 'Generating personalized recommendation...', 
      progress: 70 
    });
    
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

    console.log(`Prompt built, calling OpenAI API with streaming...`);
    const openaiStartTime = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    console.log(`OpenAI streaming API call initiated in ${Date.now() - openaiStartTime}ms`);

    sendUpdate('status', { 
      message: 'AI is writing your response...', 
      progress: 80 
    });

    let fullAnswer = '';
    
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullAnswer += content;
        sendUpdate('chunk', { content });
      }
    }

    console.log(`OpenAI streaming completed in ${Date.now() - openaiStartTime}ms`);

    sendUpdate('complete', {
      answer: fullAnswer,
      sessionContext: { 
        currentCourse: primaryCourse,
        activeCourses: coursesToUse 
      },
      _metadata: {
        responseTime: Date.now() - requestStartTime,
        cacheStats: getCacheStats()
      }
    });

  } catch (error) {
    console.error('[API Error]', error);
    sendUpdate('error', {
      error: "Whoop! We're having trouble processing your request. Please try again in a few moments."
    });
  }
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

  // Check if all courses exist (single optimized query)
  console.log('Checking course existence with batch query...');
  const courseExistsStartTime = Date.now();
  
  const existenceResults = await checkMultipleCoursesExist(coursesToUse);
  const invalidCourses = coursesToUse.filter(course => !existenceResults[course]);
    
  console.log(`Course existence check completed in ${Date.now() - courseExistsStartTime}ms`);
  
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
    console.log(`Processing ${coursesToUse.length} courses in parallel:`, coursesToUse);
    const startTime = Date.now();
    
    // Step 1: Fetch all course info in parallel
    console.log('Step 1: Fetching course info for all courses in parallel...');
    const courseInfoPromises = coursesToUse.map(async (course) => {
      const courseStartTime = Date.now();
      console.log(`Fetching course info for ${course}`);
      
      const courseInfo = await fetchCourseInfo(course);
      console.log(`Course info for ${course} fetched in ${Date.now() - courseStartTime}ms`);
      
      return { course, courseInfo };
    });
    
    const courseResults = await Promise.all(courseInfoPromises);
    
    // Store course data
    courseResults.forEach(({ course, courseInfo }) => {
      courseData[course] = courseInfo;
    });
    
    const courseInfoTime = Date.now() - startTime;
    console.log(`All course info fetched in ${courseInfoTime}ms`);
    
    // Step 2: Fetch all professor info in parallel
    console.log('Step 2: Fetching professor info for all courses in parallel...');
    const profInfoStartTime = Date.now();
    
    const profInfoPromises = courseResults.map(async ({ course, courseInfo }) => {
      const profStartTime = Date.now();
      console.log(`Fetching professor info for ${course} (${courseInfo.overall.length} professors)`);
      
      const profInfo = await fetchProfInfo(courseInfo.overall);
      console.log(`Professor info for ${course} fetched in ${Date.now() - profStartTime}ms`);
      
      return { course, profInfo };
    });
    
    const profResults = await Promise.all(profInfoPromises);
    
    // Store professor data
    profResults.forEach(({ course, profInfo }) => {
      profData[course] = profInfo;
    });
    
    const profInfoTime = Date.now() - profInfoStartTime;
    console.log(`All professor info fetched in ${profInfoTime}ms`);
    console.log(`Total data fetching completed in ${Date.now() - startTime}ms (Course Info: ${courseInfoTime}ms, Prof Info: ${profInfoTime}ms)`);
    
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

    console.log(`Prompt built, calling OpenAI API...`);
    const openaiStartTime = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    console.log(`OpenAI API call completed in ${Date.now() - openaiStartTime}ms`);

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
  const requestStartTime = Date.now();
  console.log('=== RAG API Streaming Request Started ===');
  
  try {
    const body = await req.json();
    const query = body.query;
    const conversationHistory = body.conversationHistory || [];
    const sessionContext = body.sessionContext || { currentCourse: null, activeCourses: [] };
    const useStreaming = body.useStreaming !== false; // Default to true

    console.log(`Query: "${query}" (Streaming: ${useStreaming})`);

    if (!query) {
      return Response.json({ error: 'Missing query' }, { status: 400 });
    }

    if (!useStreaming) {
      // Fallback to regular response for clients that don't support streaming
      const result = await answerWithRag(query, conversationHistory, sessionContext);
      
      const totalTime = Date.now() - requestStartTime;
      console.log(`=== RAG API Request Completed in ${totalTime}ms ===`);
      
      return Response.json({
        answer: result.answer,
        sessionContext: result.sessionContext,
        _metadata: {
          responseTime: totalTime,
          cacheStats: getCacheStats()
        }
      });
    }

    // Streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'status',
            message: 'Starting data collection...',
            progress: 0
          })}\n\n`));

          // Get the streaming result
          await answerWithRagStreaming(query, conversationHistory, sessionContext, controller, encoder, requestStartTime);
          
        } catch (error) {
          console.error('[Streaming Error]:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error.message || 'Internal Server Error'
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error) {
    const totalTime = Date.now() - requestStartTime;
    console.error(`[RAG Error] after ${totalTime}ms:`, error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}