"use client";

import React, { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Inter } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
});

// Sample data spanning multiple terms
const sampleData = [
    {
        "term": "FALL 2022",
        "instructor": "LEYK, T.",
        "avg_gpa": 3.352
    },
    {
        "term": "FALL 2022",
        "instructor": "PEARCE, R.",
        "avg_gpa": 3.859
    },
    {
        "term": "FALL 2022",
        "instructor": "CHEN, J.",
        "avg_gpa": 3.194
    },
    {
        "term": "FALL 2022",
        "instructor": "WILLIAMS, D.",
        "avg_gpa": 3.497
    },
    {
        "term": "SPRING 2023",
        "instructor": "LEYK, T.",
        "avg_gpa": 3.573
    },
    {
        "term": "SPRING 2023",
        "instructor": "PEARCE, R.",
        "avg_gpa": 3.995
    },
    {
        "term": "SPRING 2023",
        "instructor": "CHEN, J.",
        "avg_gpa": 3.243
    },
    {
        "term": "SPRING 2023",
        "instructor": "WILLIAMS, D.",
        "avg_gpa": 3.721
    },
    {
        "term": "SUMMER 2023",
        "instructor": "LEYK, T.",
        "avg_gpa": 3.592
    },
    {
        "term": "SUMMER 2023",
        "instructor": "PEARCE, R.",
        "avg_gpa": 3.932
    },
    {
        "term": "SUMMER 2023",
        "instructor": "CHEN, J.",
        "avg_gpa": 3.315
    },
    {
        "term": "SUMMER 2023",
        "instructor": "WILLIAMS, D.",
        "avg_gpa": 3.636
    },
    {
        "term": "FALL 2023",
        "instructor": "PEARCE, R.",
        "avg_gpa": 3.941
    },
    {
        "term": "FALL 2023",
        "instructor": "CHEN, J.",
        "avg_gpa": 3.39
    },
    {
        "term": "FALL 2023",
        "instructor": "WILLIAMS, D.",
        "avg_gpa": 3.61
    },
    {
        "term": "SPRING 2024",
        "instructor": "LEYK, T.",
        "avg_gpa": 3.374
    },
    {
        "term": "SPRING 2024",
        "instructor": "PEARCE, R.",
        "avg_gpa": 4
    },
    {
        "term": "SPRING 2024",
        "instructor": "CHEN, J.",
        "avg_gpa": 3.31
    },
    {
        "term": "SPRING 2024",
        "instructor": "WILLIAMS, D.",
        "avg_gpa": 3.623
    }
];

interface GPARecord {
    term: string;
    instructor: string;
    avg_gpa: number;
}

interface Props {
    data: GPARecord[];
}

// Helper function to get color class based on GPA value
const getGpaColor = (gpa: number): string => {
    if (gpa >= 3.7) return 'text-green-600';
    if (gpa >= 3.3) return 'text-green-500';
    if (gpa >= 3.0) return 'text-gray-700';
    if (gpa >= 2.7) return 'text-yellow-600';
    if (gpa >= 2.3) return 'text-orange-500';
    return 'text-red-500';
};

// Custom tooltip component to match site theme
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 border border-red-100 rounded-xl shadow-md text-sm">
                <p className="font-medium text-gray-900 mb-2">{`Term: ${label}`}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={`item-${index}`} className="flex items-center mb-1">
                        <span className="w-3 h-3 inline-block mr-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                        <span className="font-medium">{entry.name}:</span>
                        <span className="ml-2">
                            {entry.value !== null && entry.value !== undefined ? (
                                <span className={getGpaColor(entry.value)}>
                                    {Number(entry.value).toFixed(2)}
                                </span>
                            ) : 'N/A'}
                        </span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function GpaLineGraph({ data = sampleData }: Props) {
    // Active instructor state for highlighting
    const [activeInstructor, setActiveInstructor] = useState<string | null>(null);

    // Use either passed data or sample data
    const dataToUse = data?.length > 0 ? data : sampleData;

    // Extract all unique instructors
    const instructors = [...new Set(dataToUse.map((d) => d.instructor))];

    // Extract all unique terms, sorted
    const terms = [...new Set(dataToUse.map((d) => d.term))].sort();

    // Transform data into term-based format
    const chartData = terms.map(term => {
        const entry: any = { term };
        instructors.forEach(instructor => {
            const match = dataToUse.find(d => d.term === term && d.instructor === instructor);
            entry[instructor] = match ? match.avg_gpa : null;
        });
        return entry;
    });

    // More vibrant but still soft color palette
    const colors = [
        '#FF6B6B', // Soft Red
        '#4ECDC4', // Teal
        '#7971EA', // Periwinkle
        '#FFA726', // Amber
        '#66BB6A', // Light Green
        '#5C6BC0', // Indigo
        '#EC407A', // Pink
        '#26A69A', // Green
        '#AB47BC', // Purple
        '#EF5350'  // Coral
    ];


    // Calculate the overall average GPA
    const calculateAverageGpa = () => {
        if (dataToUse.length === 0) return 0;
        const sum = dataToUse.reduce((acc, curr) => acc + curr.avg_gpa, 0);
        return sum / dataToUse.length;
    };

    const averageGpa = calculateAverageGpa();

    return (
        <div className={`w-full mt-8 p-6 bg-white rounded-xl shadow-sm border border-red-100 transition-shadow hover:shadow-md ${inter.className}`}>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 30,
                        left: 20,
                        bottom: 15 // Increased bottom margin for x-axis labels
                    }}
                    onMouseLeave={() => setActiveInstructor(null)}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="term"
                        angle={-45}
                        textAnchor="end"
                        height={80} // Increased height for labels
                        tick={{ fontSize: 14, fontWeight: 'bold' }} // Bigger and bold text
                        tickMargin={15} // More space for rotated labels
                        stroke="#616161"
                    />
                    <YAxis
                        domain={[2.8, 4]}
                        tickCount={6}
                        tick={{ fontSize: 14, fontWeight: 'bold' }} // Bigger and bold text
                        stroke="#616161"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="top"
                        height={36}
                        wrapperStyle={{
                            paddingBottom: '10px',
                            fontSize: '14px',
                            fontWeight: 500
                        }}
                        onMouseEnter={(e) => setActiveInstructor(e.dataKey)}
                        onMouseLeave={() => setActiveInstructor(null)}
                    />

                    {instructors.map((instructor, index) => (
                        <Line
                            key={instructor}
                            type="monotone"
                            dataKey={instructor}
                            name={instructor}
                            stroke={colors[index % colors.length]}
                            strokeWidth={activeInstructor === instructor ? 3 : 2}
                            opacity={activeInstructor ? (activeInstructor === instructor ? 1 : 0.3) : 1}
                            dot={{
                                r: activeInstructor === instructor ? 5 : 4,
                                strokeWidth: 1,
                                fill: 'white'
                            }}
                            activeDot={{
                                r: 6,
                                strokeWidth: 0,
                                fill: colors[index % colors.length],
                                stroke: 'white'
                            }}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}