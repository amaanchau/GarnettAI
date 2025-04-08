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

        // Validate course format to prevent injection
        const isValidTable = /^[a-z]{4}[0-9]{3}$/i.test(tableName);
        if (!isValidTable) {
            return NextResponse.json({ error: 'Invalid course code format' }, { status: 400 });
        }

        const query = `
            SELECT
                instructor,
                term,
                ROUND(AVG(average_gpa)::numeric, 3) AS avg_gpa
            FROM ${tableName}
            GROUP BY instructor, term
            ORDER BY instructor, term;
        `;

        const results = await sql.query(query); // Use query instead of tagged template

        return NextResponse.json({ data: results });
    } catch (error) {
        console.error('Error fetching GPA data:', error);
        return NextResponse.json({
            error: 'Failed to fetch GPA data',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
