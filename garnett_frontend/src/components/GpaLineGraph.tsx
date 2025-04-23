"use client";

import React, { useState } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Inter } from "next/font/google";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
});

interface GPARecord {
    term: string;
    instructor: string;
    avg_gpa: number;
}

interface ChartEntry {
    term: string;
    [instructor: string]: string | number | null;
}

interface TooltipPayload {
    name: string;
    value: number;
    color: string;
}

interface TooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
}

interface Props {
    data: GPARecord[];
    selectedInstructors: string[];
}

const getGpaColor = (gpa: number): string => {
    if (gpa >= 3.7) return "text-green-600";
    if (gpa >= 3.3) return "text-green-500";
    if (gpa >= 3.0) return "text-gray-700";
    if (gpa >= 2.7) return "text-yellow-600";
    if (gpa >= 2.3) return "text-orange-500";
    return "text-red-500";
};

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
        // Sort the payload by GPA value in descending order
        const sortedPayload = [...payload].sort((a, b) => {
            // Handle null or undefined values
            if (a.value === null || a.value === undefined) return 1;
            if (b.value === null || b.value === undefined) return -1;
            // Sort by value (descending)
            return b.value - a.value;
        });

        return (
            <div className="bg-white p-4 border border-red-100 rounded-xl shadow-md text-sm"
                style={{ zIndex: 1000, position: 'relative' }}>
                <p className="font-medium text-gray-900 mb-2">{`Term: ${label}`}</p>
                {sortedPayload.map((entry, index) => (
                    <p key={`item-${index}`} className="flex items-center mb-1">
                        <span className="w-3 h-3 inline-block mr-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                        <span className="font-medium">{entry.name}</span>
                        <span className="ml-2">
                            {entry.value !== null && entry.value !== undefined ? (
                                <span className={getGpaColor(entry.value)}>
                                    {Number(entry.value).toFixed(2)}
                                </span>
                            ) : "N/A"}
                        </span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Removing custom legend component as we're using the built-in one with styling

export default function GpaLineGraph({ data, selectedInstructors }: Props) {
    const [activeInstructor, setActiveInstructor] = useState<string | null>(null);

    const instructors = [...new Set(data.map((d) => d.instructor))];
    const terms = [...new Set(data.map((d) => d.term))].sort((a, b) => {
        // Extract the season and year from the term string
        const [seasonA, yearA] = a.split(' ');
        const [seasonB, yearB] = b.split(' ');

        // Compare years first
        if (yearA !== yearB) {
            return Number(yearA) - Number(yearB);
        }

        // If years are the same, sort by season
        const seasonOrder = { 'SPRING': 1, 'SUMMER': 2, 'FALL': 3 };
        return seasonOrder[seasonA as keyof typeof seasonOrder] - seasonOrder[seasonB as keyof typeof seasonOrder];
    });

    const chartData: ChartEntry[] = terms.map(term => {
        const entry: ChartEntry = { term };
        instructors.forEach(instructor => {
            const match = data.find(d => d.term === term && d.instructor === instructor);
            entry[instructor] = match ? match.avg_gpa : null;
        });
        return entry;
    });

    const colors = [
        "#FF6B6B", "#4ECDC4", "#7971EA", "#FFA726", "#66BB6A",
        "#5C6BC0", "#EC407A", "#26A69A", "#AB47BC", "#EF5350",
        "#E75480", "#45B1E8", "#9370DB", "#E6A817", "#3CB371",
        "#4682B4", "#D2691E", "#6A5ACD", "#2E8B57", "#CD5C5C"
    ];

    // Filter only the selected instructors
    const filteredInstructors = instructors.filter(
        instructor => selectedInstructors.includes(instructor)
    );

    // No data or no selected instructors case
    if (data.length === 0 || selectedInstructors.length === 0) {
        return (
            <div className={`w-full mt-8 p-6 bg-white rounded-xl shadow-sm border border-red-100 transition-shadow hover:shadow-md ${inter.className}`}>
                <div className="h-96 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-lg font-medium">No data to display</p>
                        <p className="text-sm mt-2">Please select at least one instructor to view the GPA trends.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full mt-8 p-6 bg-white rounded-xl shadow-sm border border-red-100 transition-shadow hover:shadow-md ${inter.className}`}>
            {/* Removing instructor count warning as requested */}
            
            <ResponsiveContainer width="100%" height={400}>
                <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 25 }}
                    onMouseLeave={() => setActiveInstructor(null)}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                        dataKey="term"
                        angle={-45}
                        textAnchor="end"
                        height={85}
                        tick={{ fontSize: 12, fontWeight: "bold" }}
                        tickMargin={15}
                        stroke="#616161"
                    />
                    <YAxis
                        domain={[2.8, 4]}
                        tickCount={6}
                        tick={{ fontSize: 12, fontWeight: "bold" }}
                        stroke="#616161"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="top"
                        height={selectedInstructors.length > 8 ? 72 : selectedInstructors.length > 4 ? 54 : 36}
                        wrapperStyle={{
                            paddingBottom: "10px",
                            fontSize: "13px",
                            fontWeight: 500,
                            paddingLeft: "10px",
                            paddingRight: "10px",
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "8px",
                            lineHeight: "1.2"
                        }}
                        onMouseEnter={(e) => setActiveInstructor((e as unknown as { dataKey: string }).dataKey)}
                        onMouseLeave={() => setActiveInstructor(null)}
                    />
                    {instructors.map((instructor, index) => {
                        // Only render the line if the instructor is in the selectedInstructors array
                        if (!selectedInstructors.includes(instructor)) {
                            return null;
                        }

                        return (
                            <Line
                                key={instructor}
                                type="monotone"
                                dataKey={instructor}
                                name={instructor}
                                stroke={colors[index % colors.length]}
                                strokeWidth={activeInstructor === instructor ? 3 : 2}
                                opacity={activeInstructor ? (activeInstructor === instructor ? 1 : 0.3) : 1}
                                dot={{
                                    r: 4,
                                    strokeWidth: 1,
                                    fill: colors[index % colors.length],
                                    stroke: colors[index % colors.length]
                                }}
                                activeDot={{
                                    r: 6,
                                    strokeWidth: 2,
                                    fill: colors[index % colors.length],
                                    stroke: "#FFFFFF",
                                    filter: "drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.3))"
                                }}
                                connectNulls
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
            {/* Removing additional instructor list as requested */}
        </div>
    );
}