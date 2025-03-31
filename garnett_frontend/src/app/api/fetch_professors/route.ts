// src/app/api/fetch_professors/route.ts
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

        // Query to fetch professors from the professor table
        const results = await sql`
      SELECT instructor, department
      FROM professor
      ORDER BY instructor
    `;

        console.log('Query results:', results);

        // Extract professor data from the results
        const professors = results.map(row => ({
            name: row.instructor,
            department: row.department
        }));

        return NextResponse.json({ professors });
    } catch (error) {
        console.error('Database error details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch professors', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}