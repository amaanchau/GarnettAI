// src/app/api/fetch_courses/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: Request) {
    try {
        // Check if DATABASE_URL is defined
        if (!process.env.DATABASE_URL) {
            console.error('DATABASE_URL is not defined');
            return NextResponse.json(
                { error: 'Database connection string is missing' },
                { status: 500 }
            );
        }

        // Create a sql client
        const sql = neon(process.env.DATABASE_URL);

        // Query to fetch courses (4 characters followed by 3 numbers)
        const results = await sql`
      SELECT table_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE table_type = 'BASE TABLE'
      AND table_name ~ '^[A-Za-z]{4}[0-9]{3}$';
    `;

        console.log('Query results:', results);

        // Extract course names from the results
        const courses = results.map(row => ({
            code: row.table_name.toUpperCase(), // Ensure consistent formatting
        }));

        return NextResponse.json({ courses });
    } catch (error) {
        console.error('Database error details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch courses', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}