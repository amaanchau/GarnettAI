"use client";

import React, { useState, useEffect } from "react";
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
            <div className="glass p-3 rounded-lg shadow-md text-xs sm:text-sm border border-[rgba(128,0,32,0.1)]"
                style={{ zIndex: 1000, position: 'relative', maxWidth: '90vw' }}>
                <p className="font-medium text-gray-900 mb-1 text-xs sm:text-sm">{`Term: ${label}`}</p>
                <div className="max-h-40 overflow-y-auto">
                    {sortedPayload.map((entry, index) => (
                        <p key={`item-${index}`} className="flex items-center mb-1 text-xs sm:text-sm">
                            <span className="w-2 h-2 sm:w-3 sm:h-3 inline-block mr-1 sm:mr-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                            <span className="font-medium truncate max-w-[120px] sm:max-w-full">{entry.name}</span>
                            <span className="ml-1 sm:ml-2">
                                {entry.value !== null && entry.value !== undefined ? (
                                    <span className={getGpaColor(entry.value)}>
                                        {Number(entry.value).toFixed(2)}
                                    </span>
                                ) : "N/A"}
                            </span>
                        </p>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export default function GpaLineGraph({ data, selectedInstructors }: Props) {
    const [activeInstructor, setActiveInstructor] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Check if the viewport is mobile size
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        // Initial check
        checkMobile();

        // Add resize listener
        window.addEventListener('resize', checkMobile);

        // Cleanup
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Force re-render when selectedInstructors changes
    useEffect(() => {
        // This will trigger a re-render when selectedInstructors changes
        setActiveInstructor(null);
    }, [selectedInstructors]);

    // Debug log for troubleshooting - must be called in the same order on every render
    useEffect(() => {
        console.log("GpaLineGraph render with", selectedInstructors.length, "instructors selected");
    }, [selectedInstructors]);

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
        "#800020", "#A00030", "#C00040", "#D4A5A5", "#600018",
        "#FF6B6B", "#4ECDC4", "#7971EA", "#FFA726", "#66BB6A",
        "#5C6BC0", "#EC407A", "#26A69A", "#AB47BC", "#EF5350",
        "#E75480", "#45B1E8", "#9370DB", "#E6A817", "#3CB371"
    ];

    // Filter only the selected instructors
    const filteredInstructors = instructors.filter(
        instructor => selectedInstructors.includes(instructor)
    );

    // Calculate optimal chart height based on number of instructors
    const getOptimalChartHeight = () => {
        // Base height for desktop
        if (!isMobile) return 400;

        // On mobile, adjust based on number of instructors
        const instructorCount = selectedInstructors.length;
        if (instructorCount <= 3) return 350;
        if (instructorCount <= 6) return 380;
        return 400; // Max height for many instructors
    };

    // No data or no selected instructors case - check after all hooks are called
    if (data.length === 0 || selectedInstructors.length === 0) {
        return (
            <div className={`w-full mt-8 p-4 sm:p-6 card-modern transition-shadow hover:shadow-md ${inter.className}`}>
                <div className="h-60 sm:h-96 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-base sm:text-lg font-medium">No data to display</p>
                        <p className="text-xs sm:text-sm mt-2">Please select at least one instructor to view the GPA trends.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full mt-8 p-4 sm:p-6 card-modern transition-shadow hover:shadow-md ${inter.className}`}>
            {/* Mobile optimization hint for many instructors */}
            {isMobile && selectedInstructors.length > 5 && (
                <div className="mb-3 p-2 glass rounded-lg text-center border border-[rgba(128,0,32,0.1)]">
                    <span className="text-xs text-[#800020]">
                        Tip: Rotate your device horizontally for a better view of multiple instructors
                    </span>
                </div>
            )}

            {/* Chart container with dynamic height */}
            <div className="w-full" style={{ height: `${getOptimalChartHeight()}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={isMobile
                            ? { top: 10, right: 10, left: 0, bottom: 60 }
                            : { top: 10, right: 30, left: 20, bottom: 25 }}
                        onMouseLeave={() => setActiveInstructor(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="term"
                            angle={-45}
                            textAnchor="end"
                            height={isMobile ? 60 : 85}
                            tick={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                            tickMargin={isMobile ? 10 : 15}
                            stroke="#616161"
                            interval={isMobile ? (terms.length > 6 ? 1 : 0) : 0}
                        />
                        <YAxis
                            domain={[2.8, 4]}
                            tickCount={isMobile ? 4 : 6}
                            tick={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                            stroke="#616161"
                            width={isMobile ? 25 : 35}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Mobile-optimized Legend with horizontal scrolling */}
                        <Legend
                            verticalAlign="top"
                            height={isMobile ? 36 : (selectedInstructors.length > 8 ? 72 : selectedInstructors.length > 4 ? 54 : 36)}
                            layout={isMobile ? "horizontal" : "horizontal"}
                            wrapperStyle={{
                                paddingBottom: isMobile ? "5px" : "10px",
                                fontSize: isMobile ? "10px" : "13px",
                                fontWeight: 500,
                                paddingLeft: isMobile ? "2px" : "10px",
                                paddingRight: isMobile ? "2px" : "10px",
                                display: "flex",
                                flexWrap: isMobile ? "nowrap" : "wrap",
                                justifyContent: "center",
                                gap: isMobile ? "2px" : "8px",
                                lineHeight: "1.2",
                                margin: 0,
                                overflow: isMobile ? "auto" : "visible",
                                overflowX: isMobile ? "auto" : "visible",
                                whiteSpace: isMobile ? "nowrap" : "normal",
                                maxWidth: "100%"
                            }}
                            onMouseEnter={(e) => setActiveInstructor((e as unknown as { dataKey: string }).dataKey)}
                            onMouseLeave={() => setActiveInstructor(null)}
                            onClick={(e) => isMobile && setActiveInstructor((e as unknown as { dataKey: string }).dataKey)}
                        />

                        {/* Lines for all selected instructors */}
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
                                    strokeWidth={activeInstructor === instructor ? 3 : (isMobile ? 1.5 : 2)}
                                    opacity={activeInstructor ? (activeInstructor === instructor ? 1 : 0.3) : 1}
                                    dot={{
                                        r: isMobile ? 3 : 4,
                                        strokeWidth: 1,
                                        fill: colors[index % colors.length],
                                        stroke: colors[index % colors.length]
                                    }}
                                    activeDot={{
                                        r: isMobile ? 5 : 6,
                                        strokeWidth: isMobile ? 1 : 2,
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
            </div>
        </div>
    );
}