"use client";

import React, { useState, useEffect } from "react";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
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

type VizTab = "line" | "bar" | "heatmap";

interface Props {
    data: GPARecord[];
    selectedInstructors: string[];
}

const getGpaColor = (gpa: number): string => {
    if (gpa >= 3.7) return "text-green-600";
    if (gpa >= 3.3) return "text-green-500";
    if (gpa >= 3.0) return "text-black";
    if (gpa >= 2.7) return "text-yellow-600";
    if (gpa >= 2.3) return "text-orange-500";
    return "text-red-500";
};

const getGpaHeatmapColor = (gpa: number | null): string => {
    if (gpa === null || gpa === undefined) return "#f7f5f3";
    const t = Math.max(0, Math.min(1, (gpa - 2.8) / 1.2));
    const r = Math.round(239 + (102 - 239) * t);
    const g = Math.round(83 + (187 - 83) * t);
    const b = Math.round(80 + (106 - 80) * t);
    return `rgb(${r},${g},${b})`;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
        const sortedPayload = [...payload].sort((a, b) => {
            if (a.value === null || a.value === undefined) return 1;
            if (b.value === null || b.value === undefined) return -1;
            return b.value - a.value;
        });

        return (
            <div className="bg-white p-3 rounded-xl shadow-lg border border-[#C5C5C5]"
                style={{ zIndex: 1000, position: 'relative', maxWidth: '90vw' }}>
                <p className="font-medium text-black mb-1.5 text-xs">{`Term: ${label}`}</p>
                <div>
                    {sortedPayload.map((entry, index) => (
                        <p key={`item-${index}`} className="flex items-center mb-0.5 text-xs">
                            <span className="w-2 h-2 inline-block mr-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="font-medium truncate max-w-[80px] text-black">{entry.name}</span>
                            <span className="ml-1.5 shrink-0">
                                {entry.value !== null && entry.value !== undefined ? (
                                    <span className={getGpaColor(Number(entry.value))}>
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
    const [vizTab, setVizTab] = useState<VizTab>("line");
    const [activeInstructor, setActiveInstructor] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [focusedInstructor, setFocusedInstructor] = useState<string | null>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        setActiveInstructor(null);
        setFocusedInstructor(null);
    }, [selectedInstructors]);

    const instructors = [...new Set(data.map((d) => d.instructor))];
    const terms = [...new Set(data.map((d) => d.term))].sort((a, b) => {
        const [seasonA, yearA] = a.split(' ');
        const [seasonB, yearB] = b.split(' ');
        if (yearA !== yearB) return Number(yearA) - Number(yearB);
        const seasonOrder = { 'SPRING': 1, 'SUMMER': 2, 'FALL': 3 };
        return seasonOrder[seasonA as keyof typeof seasonOrder] - seasonOrder[seasonB as keyof typeof seasonOrder];
    });

    const chartData: ChartEntry[] = terms.map(term => {
        const entry: ChartEntry = { term };
        instructors.forEach(instructor => {
            const match = data.find(d => d.term === term && d.instructor === instructor);
            const raw = match ? match.avg_gpa : null;
            entry[instructor] = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        });
        return entry;
    });

    const colors = [
        "#800020", "#A00030", "#C00040", "#D4A5A5", "#600018",
        "#FF6B6B", "#4ECDC4", "#7971EA", "#FFA726", "#66BB6A",
        "#5C6BC0", "#EC407A", "#26A69A", "#AB47BC", "#EF5350",
        "#E75480", "#45B1E8", "#9370DB", "#E6A817", "#3CB371"
    ];

    const filteredInstructors = instructors.filter(
        instructor => selectedInstructors.includes(instructor)
    );

    const getOptimalChartHeight = () => {
        if (!isMobile) return 400;
        const count = selectedInstructors.length;
        if (count <= 3) return 350;
        if (count <= 6) return 380;
        return 400;
    };

    const toggleFocusMode = () => {
        setFocusMode(!focusMode);
        if (focusMode) setFocusedInstructor(null);
    };

    const handleInstructorFocus = (instructor: string) => {
        if (focusMode) setFocusedInstructor(focusedInstructor === instructor ? null : instructor);
    };

    if (data.length === 0 || selectedInstructors.length === 0) {
        return (
            <div className={`w-full mt-6 p-6 bg-white border border-[#C5C5C5] rounded-xl ${inter.className}`}>
                <div className="h-60 sm:h-80 flex items-center justify-center">
                    <div className="text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-base font-medium text-black">No data to display</p>
                        <p className="text-sm mt-1 text-[#888]">Select at least one instructor to view GPA trends.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full mt-6 p-4 sm:p-6 bg-white border border-[#C5C5C5] rounded-xl ${inter.className}`}>
            {/* Chart Controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-black">GPA Trends</h3>
                    {selectedInstructors.length > 3 && (
                        <span className="text-xs bg-[#800020] text-white px-2 py-0.5 rounded-full">
                            {selectedInstructors.length} instructors
                        </span>
                    )}
                </div>
                <div className="flex gap-1 p-0.5 rounded-lg bg-[#f7f5f3] border border-[#C5C5C5]" role="tablist" aria-label="Chart type">
                    {(["line", "bar", "heatmap"] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={vizTab === tab}
                            onClick={() => setVizTab(tab)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                                vizTab === tab
                                    ? "bg-[#800020] text-white shadow-sm"
                                    : "text-black hover:bg-white"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                {(vizTab === "line" || vizTab === "bar") && selectedInstructors.length > 3 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleFocusMode}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                                focusMode
                                    ? 'bg-[#800020] text-white'
                                    : 'bg-[#f7f5f3] text-black border border-[#C5C5C5] hover:border-[#800020]'
                            }`}
                        >
                            {focusMode ? 'Exit Focus' : 'Focus Mode'}
                        </button>
                        {focusMode && (
                            <span className="text-xs text-[#888]">Click an instructor to focus</span>
                        )}
                    </div>
                )}
            </div>

            {(vizTab === "line" || vizTab === "bar") && isMobile && selectedInstructors.length > 5 && (
                <div className="mb-3 p-2 bg-[#f7f5f3] rounded-lg text-center border border-[#C5C5C5]">
                    <span className="text-xs text-[#800020]">
                        Tip: Rotate your device for a better view of multiple instructors
                    </span>
                </div>
            )}

            {vizTab === "line" && (
            <div className="w-full" style={{ height: `${getOptimalChartHeight()}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={isMobile
                            ? { top: 10, right: 10, left: 0, bottom: 60 }
                            : { top: 10, right: 30, left: 20, bottom: 25 }}
                        onMouseLeave={() => setActiveInstructor(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e5e2" />
                        <XAxis
                            dataKey="term"
                            angle={-45}
                            textAnchor="end"
                            height={isMobile ? 60 : 85}
                            tick={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                            tickMargin={isMobile ? 10 : 15}
                            stroke="#888"
                            interval={isMobile ? (terms.length > 6 ? 1 : 0) : 0}
                        />
                        <YAxis
                            domain={[2.8, 4]}
                            tickCount={isMobile ? 4 : 6}
                            tick={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                            stroke="#888"
                            width={isMobile ? 25 : 35}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            height={isMobile ? 36 : (selectedInstructors.length > 8 ? 72 : selectedInstructors.length > 4 ? 54 : 36)}
                            layout="horizontal"
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
                            onClick={(e) => {
                                const dataKey = (e as unknown as { dataKey: string }).dataKey;
                                if (isMobile) setActiveInstructor(dataKey);
                                if (focusMode) handleInstructorFocus(dataKey);
                            }}
                        />
                        {instructors.map((instructor, index) => {
                            if (!selectedInstructors.includes(instructor)) return null;

                            let opacity = 1;
                            let strokeWidth = isMobile ? 1.5 : 2;

                            if (focusMode && focusedInstructor) {
                                if (focusedInstructor === instructor) {
                                    opacity = 1; strokeWidth = 4;
                                } else {
                                    opacity = 0.2; strokeWidth = 1;
                                }
                            } else if (activeInstructor) {
                                if (activeInstructor === instructor) {
                                    opacity = 1; strokeWidth = 3;
                                } else {
                                    opacity = 0.3; strokeWidth = 1;
                                }
                            }

                            return (
                                <Line
                                    key={instructor}
                                    type="monotone"
                                    dataKey={instructor}
                                    name={instructor}
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={strokeWidth}
                                    opacity={opacity}
                                    dot={{
                                        r: isMobile ? 3 : 4,
                                        strokeWidth: 1,
                                        fill: colors[index % colors.length],
                                        stroke: colors[index % colors.length],
                                        opacity: opacity
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
            )}

            {vizTab === "bar" && (
            <div className="w-full" style={{ height: `${getOptimalChartHeight()}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={isMobile
                            ? { top: 10, right: 10, left: 0, bottom: 60 }
                            : { top: 10, right: 30, left: 20, bottom: 25 }}
                        onMouseLeave={() => setActiveInstructor(null)}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e5e2" />
                        <XAxis
                            dataKey="term"
                            angle={-45}
                            textAnchor="end"
                            height={isMobile ? 60 : 85}
                            tick={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                            tickMargin={isMobile ? 10 : 15}
                            stroke="#888"
                            interval={isMobile ? (terms.length > 6 ? 1 : 0) : 0}
                        />
                        <YAxis
                            domain={[2.8, 4]}
                            tickCount={isMobile ? 4 : 6}
                            tick={{ fontSize: isMobile ? 10 : 12, fontWeight: "bold" }}
                            stroke="#888"
                            width={isMobile ? 25 : 35}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="top"
                            height={isMobile ? 36 : (selectedInstructors.length > 8 ? 72 : selectedInstructors.length > 4 ? 54 : 36)}
                            layout="horizontal"
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
                            onClick={(e) => {
                                const dataKey = (e as unknown as { dataKey: string }).dataKey;
                                if (isMobile) setActiveInstructor(dataKey);
                                if (focusMode) handleInstructorFocus(dataKey);
                            }}
                        />
                        {instructors.map((instructor, index) => {
                            if (!selectedInstructors.includes(instructor)) return null;
                            let opacity = 1;
                            if (focusMode && focusedInstructor) {
                                opacity = focusedInstructor === instructor ? 1 : 0.2;
                            } else if (activeInstructor) {
                                opacity = activeInstructor === instructor ? 1 : 0.3;
                            }
                            return (
                                <Bar
                                    key={instructor}
                                    dataKey={instructor}
                                    name={instructor}
                                    fill={colors[index % colors.length]}
                                    fillOpacity={opacity}
                                    radius={[2, 2, 0, 0]}
                                    maxBarSize={isMobile ? 24 : 32}
                                />
                            );
                        })}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            )}

            {vizTab === "heatmap" && (
            <div className="w-full overflow-x-auto rounded-xl border border-[#C5C5C5]">
                <div
                    className="inline-block min-w-full rounded-xl overflow-hidden"
                    style={{
                        display: "grid",
                        gridTemplateColumns: `auto repeat(${terms.length}, minmax(${isMobile ? 48 : 64}px, 1fr))`,
                        gridTemplateRows: `auto repeat(${filteredInstructors.length}, 40px)`,
                        gap: 2,
                        backgroundColor: "#e8e5e2",
                    }}
                >
                    <div
                        className="bg-white font-semibold text-xs text-[#800020] flex items-center justify-center px-2 py-3 sticky left-0 z-20 rounded-tl-xl border-r border-b border-[#C5C5C5]"
                        style={{ gridColumn: 1, gridRow: 1 }}
                    />
                    {terms.map((term, c) => (
                        <div
                            key={term}
                            className="bg-white font-semibold text-xs text-[#800020] flex items-center justify-center py-3 truncate px-1 border-b border-[#C5C5C5]"
                            style={{ gridColumn: c + 2, gridRow: 1 }}
                            title={term}
                        >
                            {term}
                        </div>
                    ))}
                    {filteredInstructors.map((instructor, r) => (
                        <React.Fragment key={instructor}>
                            <div
                                className="bg-white font-medium text-xs text-black flex items-center truncate pl-3 pr-2 py-2 sticky left-0 z-10 border-r border-[#C5C5C5]"
                                style={{ gridColumn: 1, gridRow: r + 2 }}
                                title={instructor}
                            >
                                {instructor}
                            </div>
                            {terms.map((term, c) => {
                                const match = data.find(d => d.term === term && d.instructor === instructor);
                                const raw = match ? match.avg_gpa : null;
                                const gpaNum = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
                                const bg = getGpaHeatmapColor(gpaNum);
                                const displayText = gpaNum !== null ? Number(gpaNum).toFixed(2) : "—";
                                const titleText = gpaNum !== null ? `${instructor} – ${term}: ${displayText}` : `${instructor} – ${term}: N/A`;
                                return (
                                    <div
                                        key={`${instructor}-${term}`}
                                        className="flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-[#800020]/30 hover:ring-offset-1 hover:z-[5] cursor-default"
                                        style={{
                                            gridColumn: c + 2,
                                            gridRow: r + 2,
                                            backgroundColor: bg,
                                            color: gpaNum !== null ? (gpaNum >= 3.2 ? "#1f2937" : "#374151") : "#888",
                                        }}
                                        title={titleText}
                                    >
                                        {displayText}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
                <p className="text-xs text-[#888] mt-3 text-center px-2 pb-3">
                    <span className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#f7f5f3] border border-[#C5C5C5]">
                        <span className="w-2 h-2 rounded-full bg-[#ef5350]" aria-hidden />
                        <span>Lower GPA</span>
                        <span className="text-[#800020] font-medium">&rarr;</span>
                        <span className="w-2 h-2 rounded-full bg-[#66BB6A]" aria-hidden />
                        <span>Higher GPA</span>
                    </span>
                    <span className="block mt-1.5 text-[#888]">Hover a cell to see details.</span>
                </p>
            </div>
            )}
        </div>
    );
}
