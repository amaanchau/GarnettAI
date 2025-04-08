import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(req: NextRequest) {
    const course = req.nextUrl.searchParams.get('course');

    if (!course) {
        return NextResponse.json({ error: 'Missing course parameter' }, { status: 400 });
    }

    try {
        if (!process.env.DATABASE_URL) {
            console.error('DATABASE_URL is not defined');
            return NextResponse.json({ error: 'Database connection string is missing' }, { status: 500 });
        }

        const sql = neon(process.env.DATABASE_URL);
        const tableName = course.toLowerCase();

        // Validate table name (e.g., CSCE221, ECEN248, etc.)
        const isValidTable = /^[a-z]{4}[0-9]{3}$/i.test(tableName);
        if (!isValidTable) {
            return NextResponse.json({ error: 'Invalid course code format' }, { status: 400 });
        }

        // Run the JOIN query to get course + RMP link
        const query = `
            SELECT ${tableName}.*, professor.rmp_link
            FROM ${tableName}
            JOIN professor ON ${tableName}.instructor = professor.instructor;
        `;

        const results = await sql.query(query);
        return NextResponse.json({ data: results });


    } catch (error) {
        console.error('Error fetching course data:', error);
        return NextResponse.json({
            error: 'Failed to fetch course data',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
