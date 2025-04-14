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
    // We're removing these unused props
    // onToggleInstructor: (instructor: string) => void;
    // onToggleAllInstructors: () => void;
    // selectedInstructors: string[];
}

export default function CourseDataTable({ data }: Props) {
    const [sortField, setSortField] = useState<string>("average_gpa");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [filteredData, setFilteredData] = useState<CourseData[]>([]);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [animateStats, setAnimateStats] = useState(false);

    // Trigger animation when stats change
    useEffect(() => {
        setAnimateStats(true);
        const timer = setTimeout(() => setAnimateStats(false), 500);
        return () => clearTimeout(timer);
    }, [filteredData]);

    // The expected columns in order
    const orderedHeaders = [
        "term",
        "instructor",
        "total",
        "a",
        "b",
        "c",
        "d",
        "f",
        "q",
        "i",
        "s",
        "u",
        "x",
        "average_gpa",
        "rmp_link"
    ];

    // Sort data function (returns sorted data without setting state)
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

            return direction === "asc"
                ? valA.localeCompare(valB)
                : valB.localeCompare(valA);
        });
    };

    // Initialize filtered data
    useEffect(() => {
        if (!data || data.length === 0) return;

        // Apply initial sorting and set filtered data
        const sorted = sortDataFunction(data, sortField, sortDirection);
        setFilteredData(sorted);
    }, [data, sortField, sortDirection]);

    // Handle sorting
    const handleSort = (field: string) => {
        const newDirection =
            field === sortField
                ? sortDirection === "asc" ? "desc" : "asc"
                : "desc";

        setSortField(field);
        setSortDirection(newDirection);
    };

    // Helper function to get color based on GPA value
    const getGpaColor = (gpa: number): string => {
        if (gpa >= 3.7) return 'text-green-600';
        if (gpa >= 3.3) return 'text-green-500';
        if (gpa >= 3.0) return 'text-gray-700';
        if (gpa >= 2.7) return 'text-yellow-600';
        if (gpa >= 2.3) return 'text-orange-500';
        return 'text-red-500';
    };

    const tooltipMap: Record<string, string> = {
        term: "Semester and Year",
        average_gpa: "Average GPA",
        rmp_link: "Rate My Professor Link",
        instructor: "Instructor Name",
        total: "Total Students",
        a: "A Grades",
        b: "B Grades",
        c: "C Grades",
        d: "D Grades",
        f: "F Grades",
        q: "Dropped",
        u: "Unsatisfactory",
        s: "Satisfactory",
        i: "Incomplete",
        x: "No Grade Assigned"
    };

    if (!data || data.length === 0) {
        return <div className="mt-10 p-4 bg-red-50 text-red-500 rounded-lg">No course data available</div>;
    }

    return (
        <div className={`w-full mt-1 ${inter.className}`}>
            {/* Table */}
            <div className="overflow-x-auto p-6 bg-white rounded-xl shadow-sm border border-red-100 transition-shadow hover:shadow-md">
                {filteredData.length === 0 ? (
                    <div className="p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-700 mb-2">No data to display</h3>
                        <p className="text-gray-500">Please select at least one instructor to view course data.</p>
                    </div>
                ) : (
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-red-100 text-gray-700 border-b border-red-200">
                                {orderedHeaders.map((header) => (
                                    <th
                                        key={header}
                                        className="px-4 py-3 text-center font-bold cursor-pointer transition-all duration-300 ease-in-out hover:bg-red-50 hover:text-gray-700"
                                        onClick={() => handleSort(header)}
                                    >
                                        <div className="flex items-center justify-center space-x-1">
                                            <div className="relative group inline-flex justify-center items-center">
                                                <span className="uppercase font-bold">
                                                    {header.replace(/_/g, " ")}
                                                </span>
                                                {tooltipMap[header] && (
                                                    <div className="absolute bottom-full mb-2 w-max max-w-xs px-3 py-1.5 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transform translate-y-2 transition-all z-50 whitespace-nowrap">
                                                        {tooltipMap[header]}
                                                    </div>
                                                )}
                                            </div>


                                            {header === sortField && (
                                                <span className="text-red-600 ml-1">
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
                                    className={`border-b border-gray-100 transition-colors ${hoveredRow === idx
                                        ? 'bg-red-50 transform scale-[1.01] shadow-sm'
                                        : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                        }`}
                                    style={{ transition: 'all 0.2s ease' }}
                                    onMouseEnter={() => setHoveredRow(idx)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                >
                                    {orderedHeaders.map((key) => (
                                        <td
                                            key={key}
                                            className="px-4 py-3 text-center"
                                        >
                                            {key === "rmp_link" && row[key] ? (
                                                <a
                                                    href={String(row[key])}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-red-600 hover:text-red-700 transition-colors inline-flex items-center justify-center group"
                                                >
                                                    <span className="bg-red-50 px-3 py-1 rounded-l-md group-hover:bg-red-100 transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </span>
                                                    <span className="border border-red-100 border-l-0 px-3 py-1 rounded-r-md group-hover:border-red-200 transition-colors">
                                                        RMP
                                                    </span>
                                                </a>
                                            ) : key === "average_gpa" && typeof row[key] === "number" ? (
                                                <span className={`font-medium ${getGpaColor(row[key] as number)} inline-flex items-center`}>
                                                    {(row[key] as number).toFixed(3)}
                                                    {(row[key] as number) > 3.5 && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    )}
                                                    {(row[key] as number) < 2.5 && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                    )}
                                                </span>
                                            ) : key === "instructor" ? (
                                                <span className="font-medium text-gray-800">
                                                    {row[key]}
                                                </span>
                                            ) : (
                                                <span>
                                                    {row[key] !== null && row[key] !== undefined ? row[key] : "-"}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Stats Summary - Modern Style Matching Home Page */}
            <div className="mt-8">
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`bg-white p-5 rounded-xl border border-red-100 shadow-sm text-center transition-all duration-300 ${animateStats ? 'transform scale-105' : ''
                        }`}>
                        <p className="text-4xl font-bold text-gray-800">
                            {filteredData.length > 0
                                ? (filteredData.reduce((sum, row) =>
                                    sum + (typeof row.average_gpa === 'number' ? row.average_gpa : 0), 0) /
                                    filteredData.length).toFixed(2)
                                : "N/A"}
                        </p>
                        <p className="text-sm text-gray-500 mt-2 uppercase tracking-wider">Average GPA</p>
                        <div className="mt-3 pt-3">
                            <div className="h-1 w-16 bg-red-100 rounded-full mx-auto"></div>
                        </div>
                    </div>
                    <div className={`bg-white p-5 rounded-xl border border-red-100 shadow-sm text-center transition-all duration-300 ${animateStats ? 'transform scale-105' : ''
                        }`}>
                        <p className="text-4xl font-bold text-gray-800">
                            {filteredData.reduce((sum, row) =>
                                sum + (typeof row.total === 'number' ? row.total : 0), 0)}
                        </p>
                        <p className="text-sm text-gray-500 mt-2 uppercase tracking-wider">Total Students</p>
                        <div className="mt-3 pt-3">
                            <div className="h-1 w-16 bg-red-100 rounded-full mx-auto"></div>
                        </div>
                    </div>
                    <div className={`bg-white p-5 rounded-xl border border-red-100 shadow-sm text-center transition-all duration-300 ${animateStats ? 'transform scale-105' : ''
                        }`}>
                        <p className="text-4xl font-bold text-gray-800">
                            {filteredData.length > 0
                                ? (filteredData.reduce((sum, row) =>
                                    sum + (typeof row.a === 'number' && typeof row.total === 'number'
                                        ? row.a / row.total * 100 : 0), 0) /
                                    filteredData.length).toFixed(1) + "%"
                                : "N/A"}
                        </p>
                        <p className="text-sm text-gray-500 mt-2 uppercase tracking-wider">A Rate</p>
                        <div className="mt-3 pt-3">
                            <div className="h-1 w-16 bg-red-100 rounded-full mx-auto"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}