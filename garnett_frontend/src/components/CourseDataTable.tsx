"use client";

import React, { useState, useEffect } from "react";
import { Inter } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
});

interface CourseData {
    [key: string]: string | number | null;
}

interface Props {
    data: CourseData[];
}

export default function CourseDataTable({ data }: Props) {
    const [sortField, setSortField] = useState<string>("average_gpa");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [filteredData, setFilteredData] = useState<CourseData[]>([]);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [animateStats, setAnimateStats] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        setAnimateStats(true);
        const timer = setTimeout(() => setAnimateStats(false), 500);
        return () => clearTimeout(timer);
    }, [filteredData]);

    const mobileVisibleColumns = ["term", "instructor", "average_gpa", "rmp_link"];

    const orderedHeaders = [
        "term", "instructor", "total",
        "a", "b", "c", "d", "f", "q", "i", "s", "u", "x",
        "average_gpa", "rmp_link"
    ];

    const sortDataFunction = (dataToSort: CourseData[], field: string, direction: "asc" | "desc") => {
        if (!dataToSort || dataToSort.length === 0) return [];
        return [...dataToSort].sort((a, b) => {
            if (a[field] === null || a[field] === undefined) return 1;
            if (b[field] === null || b[field] === undefined) return -1;
            if (typeof a[field] === "number" && typeof b[field] === "number") {
                return direction === "asc" ? a[field] - b[field] : b[field] - a[field];
            }
            const valA = String(a[field]).toLowerCase();
            const valB = String(b[field]).toLowerCase();
            return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    };

    useEffect(() => {
        if (!data || data.length === 0) return;
        const sorted = sortDataFunction(data, sortField, sortDirection);
        setFilteredData(sorted);
    }, [data, sortField, sortDirection]);

    const handleSort = (field: string) => {
        const newDirection = field === sortField
            ? sortDirection === "asc" ? "desc" : "asc"
            : "desc";
        setSortField(field);
        setSortDirection(newDirection);
    };

    const getGpaColor = (gpa: number): string => {
        if (gpa >= 3.7) return 'text-green-600';
        if (gpa >= 3.3) return 'text-green-500';
        if (gpa >= 3.0) return 'text-black';
        if (gpa >= 2.7) return 'text-yellow-600';
        if (gpa >= 2.3) return 'text-orange-500';
        return 'text-red-500';
    };

    const toggleRowExpansion = (index: number) => {
        setExpandedRow(expandedRow === index ? null : index);
    };

    const tooltipMap: Record<string, string> = {
        term: "Semester and Year",
        average_gpa: "Average GPA",
        rmp_link: "Rate My Professor Link",
        instructor: "Instructor Name",
        total: "Total Students",
        a: "A Grades", b: "B Grades", c: "C Grades", d: "D Grades", f: "F Grades",
        q: "Dropped", u: "Unsatisfactory", s: "Satisfactory", i: "Incomplete", x: "No Grade Assigned"
    };

    if (!data || data.length === 0) {
        return (
            <div className="mt-8 p-4 mb-10 bg-white text-[#800020] rounded-xl border border-[#C5C5C5]">
                No course data available
            </div>
        );
    }

    const renderMobileTable = () => (
        <div className="overflow-hidden space-y-2">
            {filteredData.map((row, idx) => (
                <div
                    key={idx}
                    className={`rounded-xl border transition-all duration-200 ${
                        expandedRow === idx
                            ? 'border-[#800020]/30 shadow-md bg-white'
                            : 'border-[#C5C5C5] bg-white'
                    }`}
                >
                    <div
                        className="flex items-center p-3 cursor-pointer"
                        onClick={() => toggleRowExpansion(idx)}
                    >
                        <div className="flex-1">
                            <div className="font-medium text-black">{row.term}</div>
                            <div className="text-sm text-[#444]">{row.instructor}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className={`text-lg font-bold ${getGpaColor(Number(row.average_gpa))}`}>
                                {row.average_gpa != null && !Number.isNaN(Number(row.average_gpa)) ? Number(row.average_gpa).toFixed(2) : 'N/A'}
                            </div>
                            {typeof row.rmp_link === 'string' && row.rmp_link && (
                                <a
                                    href={row.rmp_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#800020] text-white p-1.5 rounded-lg"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-5 w-5 text-[#888] transition-transform ${expandedRow === idx ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    {expandedRow === idx && (
                        <div className="px-3 pb-3 pt-1 border-t border-[#C5C5C5]/40">
                            <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="p-2 bg-[#f7f5f3] rounded-lg">
                                    <div className="text-xs text-[#888]">Total</div>
                                    <div className="font-medium text-black">{row.total}</div>
                                </div>
                                <div className="p-2 bg-[#f7f5f3] rounded-lg">
                                    <div className="text-xs text-[#888]">A</div>
                                    <div className="font-medium text-green-600">{row.a}</div>
                                </div>
                                <div className="p-2 bg-[#f7f5f3] rounded-lg">
                                    <div className="text-xs text-[#888]">B</div>
                                    <div className="font-medium text-green-500">{row.b}</div>
                                </div>
                                <div className="p-2 bg-[#f7f5f3] rounded-lg">
                                    <div className="text-xs text-[#888]">C</div>
                                    <div className="font-medium text-yellow-600">{row.c}</div>
                                </div>
                                <div className="p-2 bg-[#f7f5f3] rounded-lg">
                                    <div className="text-xs text-[#888]">D</div>
                                    <div className="font-medium text-orange-500">{row.d}</div>
                                </div>
                                <div className="p-2 bg-[#f7f5f3] rounded-lg">
                                    <div className="text-xs text-[#888]">F</div>
                                    <div className="font-medium text-red-500">{row.f}</div>
                                </div>
                            </div>
                            <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
                                {["q", "i", "s", "u", "x"].map(key => (
                                    row[key] && Number(row[key]) > 0 ? (
                                        <div key={key} className="p-2 bg-[#f7f5f3] rounded-lg">
                                            <div className="text-xs text-[#888]">{tooltipMap[key]}</div>
                                            <div className="font-medium text-black">{row[key]}</div>
                                        </div>
                                    ) : null
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderDesktopTable = () => (
        <table className="min-w-full text-sm">
            <thead>
                <tr className="bg-[#f7f5f3] border-b border-[#C5C5C5]">
                    {orderedHeaders.map((header) => (
                        <th
                            key={header}
                            className="px-4 py-3 text-center font-semibold text-black cursor-pointer transition-colors hover:bg-[#e8e5e2]"
                            onClick={() => handleSort(header)}
                        >
                            <div className="flex items-center justify-center space-x-1">
                                <div className="relative group inline-flex justify-center items-center">
                                    <span className="uppercase text-xs font-bold tracking-wider">
                                        {header.replace(/_/g, " ")}
                                    </span>
                                    {tooltipMap[header] && (
                                        <div className="absolute bottom-full mb-2 w-max max-w-xs px-3 py-1.5 text-xs text-white bg-[#373230] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all z-50 whitespace-nowrap">
                                            {tooltipMap[header]}
                                        </div>
                                    )}
                                </div>
                                {header === sortField && (
                                    <span className="text-[#800020] ml-1 font-bold">
                                        {sortDirection === "asc" ? "↑" : "↓"}
                                    </span>
                                )}
                            </div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {filteredData.map((row, idx) => (
                    <tr
                        key={idx}
                        className={`border-b border-[#C5C5C5]/30 transition-colors ${
                            hoveredRow === idx
                                ? 'bg-[#f7f5f3]'
                                : idx % 2 === 0 ? 'bg-white' : 'bg-[#f7f5f3]/50'
                        }`}
                        onMouseEnter={() => setHoveredRow(idx)}
                        onMouseLeave={() => setHoveredRow(null)}
                    >
                        {orderedHeaders.map((key) => (
                            <td key={key} className="px-4 py-3 text-center">
                                {key === "rmp_link" && row[key] ? (
                                    <a
                                        href={String(row[key])}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-white bg-[#800020] hover:bg-[#600018] px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        RMP
                                    </a>
                                ) : key === "average_gpa" ? (() => {
                                    const num = Number(row[key]);
                                    const valid = row[key] != null && !Number.isNaN(num);
                                    return valid ? (
                                        <span className={`font-semibold ${getGpaColor(num)} inline-flex items-center`}>
                                            {num.toFixed(3)}
                                            {num > 3.5 && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                            {num < 2.5 && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-[#888]">{row[key] !== null && row[key] !== undefined ? String(row[key]) : "-"}</span>
                                    );
                                })() : key === "instructor" ? (
                                    <span className="font-medium text-black">{row[key]}</span>
                                ) : (
                                    <span className="text-[#444]">{row[key] !== null && row[key] !== undefined ? row[key] : "-"}</span>
                                )}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <div className={`w-full mt-4 ${inter.className}`}>
            {isMobile && (
                <div className="mb-4 bg-white border border-[#C5C5C5] rounded-xl p-3">
                    <div className="text-sm font-semibold text-black mb-2">Sort by</div>
                    <div className="flex flex-wrap gap-2">
                        {["term", "instructor", "average_gpa"].map((field) => (
                            <button
                                key={field}
                                onClick={() => handleSort(field)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                    sortField === field
                                        ? 'bg-[#800020] text-white'
                                        : 'bg-[#f7f5f3] text-black border border-[#C5C5C5] hover:border-[#800020]'
                                }`}
                            >
                                {field.replace(/_/g, " ")}
                                {sortField === field && (
                                    <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="overflow-x-auto bg-white border border-[#C5C5C5] rounded-xl p-4 sm:p-6">
                {filteredData.length === 0 ? (
                    <div className="p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-base font-medium text-black mb-1">No data to display</h3>
                        <p className="text-sm text-[#888]">Select at least one instructor to view course data.</p>
                    </div>
                ) : (
                    isMobile ? renderMobileTable() : renderDesktopTable()
                )}
            </div>

            {/* Stats Summary */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`bg-white border border-[#C5C5C5] rounded-xl p-5 text-center transition-all duration-300 ${animateStats ? 'scale-[1.02]' : ''}`}>
                    <p className="text-3xl sm:text-4xl font-bold text-black">
                        {filteredData.length > 0
                            ? (filteredData.reduce((sum, row) =>
                                sum + (typeof row.average_gpa === 'number' ? row.average_gpa : 0), 0) /
                                filteredData.length).toFixed(2)
                            : "N/A"}
                    </p>
                    <p className="text-xs text-[#888] mt-2 uppercase tracking-wider font-medium">Average GPA</p>
                    <div className="mt-3 h-1 w-12 bg-[#800020] rounded-full mx-auto" />
                </div>
                <div className={`bg-white border border-[#C5C5C5] rounded-xl p-5 text-center transition-all duration-300 ${animateStats ? 'scale-[1.02]' : ''}`}>
                    <p className="text-3xl sm:text-4xl font-bold text-black">
                        {filteredData.reduce((sum, row) =>
                            sum + (typeof row.total === 'number' ? row.total : 0), 0)}
                    </p>
                    <p className="text-xs text-[#888] mt-2 uppercase tracking-wider font-medium">Total Students</p>
                    <div className="mt-3 h-1 w-12 bg-[#800020] rounded-full mx-auto" />
                </div>
                <div className={`bg-white border border-[#C5C5C5] rounded-xl p-5 text-center transition-all duration-300 ${animateStats ? 'scale-[1.02]' : ''}`}>
                    <p className="text-3xl sm:text-4xl font-bold text-black">
                        {filteredData.length > 0
                            ? (filteredData.reduce((sum, row) =>
                                sum + (typeof row.a === 'number' && typeof row.total === 'number'
                                    ? row.a / row.total * 100 : 0), 0) /
                                filteredData.length).toFixed(1) + "%"
                            : "N/A"}
                    </p>
                    <p className="text-xs text-[#888] mt-2 uppercase tracking-wider font-medium">A Rate</p>
                    <div className="mt-3 h-1 w-12 bg-[#800020] rounded-full mx-auto" />
                </div>
            </div>
        </div>
    );
}
