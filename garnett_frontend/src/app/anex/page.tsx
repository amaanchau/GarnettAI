"use client";

import { useState, useEffect, useRef } from 'react';
import { Inter } from 'next/font/google';
import Navbar from "@/components/Navbar";
import GpaLineGraph from "@/components/GpaLineGraph";
import CourseDataTable from "@/components/CourseDataTable";
import { motion, AnimatePresence } from 'framer-motion';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
});

// Course type
interface Course {
    code: string;
    name?: string;
}

interface SearchResult {
    id: string;
    type: 'course';
    displayText: string;
    original: Course;
}

export default function AnexPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchContainerRef = useRef<HTMLDivElement | null>(null);
    const [gpaData, setGpaData] = useState([]);
    const [courseData, setCourseData] = useState([]);

    // Fetch courses data on component mount
    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch courses
                const coursesResponse = await fetch('/api/fetch_courses');

                if (!coursesResponse.ok) {
                    throw new Error('Failed to fetch courses');
                }

                const coursesData = await coursesResponse.json();
                setCourses(coursesData.courses || []);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load course data. Please try again later.');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Handle clicking outside of search results to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Search logic - now only for courses
    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        // Filter based on search term
        const term = searchTerm.toLowerCase();

        // Search courses only
        const matchingCourses = courses
            .filter(course =>
                course.code.toLowerCase().includes(term)
            )
            .map(course => ({
                id: `course-${course.code}`,
                type: 'course' as const,
                displayText: course.code,
                original: course
            }));

        // Sort results and limit to top 10
        matchingCourses.sort((a, b) => {
            // Sort exact matches to the top
            const aStartsWithTerm = a.displayText.toLowerCase().startsWith(term);
            const bStartsWithTerm = b.displayText.toLowerCase().startsWith(term);

            if (aStartsWithTerm && !bStartsWithTerm) return -1;
            if (!aStartsWithTerm && bStartsWithTerm) return 1;

            // Then alphabetically
            return a.displayText.localeCompare(b.displayText);
        });

        setSearchResults(matchingCourses.slice(0, 10));
        setShowResults(matchingCourses.length > 0);
    }, [searchTerm, courses]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length >= 2) {
            setShowResults(true);
        }
    };

    const handleResultClick = async (result: SearchResult) => {
        setSearchTerm(result.displayText);
        setShowResults(false);

        // Only fetch course data
        const [gpaRes, courseDataRes] = await Promise.all([
            fetch(`/api/get_gpa_by_term?course=${result.displayText}`),
            fetch(`/api/get_course_data?course=${result.displayText}`)
        ]);
        const gpaJson = await gpaRes.json();
        const courseJson = await courseDataRes.json();
        setGpaData(gpaJson.data || []);
        setCourseData(courseJson.data || []);
    };

    return (
        <div className={`flex flex-col min-h-screen bg-white ${inter.className}`}>
            <Navbar conversationStarted={false} />
            <main className="flex-grow flex flex-col items-center px-4">
                {/* Compact search section - positioned higher */}
                <div className="w-full max-w-2xl mx-auto mt-2 relative" ref={searchContainerRef}>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            placeholder="Search courses..."
                            className="w-full p-4 pl-12 rounded-xl border border-red-100 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all shadow-sm text-lg"
                            disabled={loading}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            {loading ? (
                                <svg className="animate-spin h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-500 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    {/* Search results dropdown */}
                    <AnimatePresence>
                        {showResults && searchResults.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="absolute z-10 mt-2 w-full left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-h-[350px] overflow-y-auto"
                                style={{ maxWidth: '100%', width: '100%' }}
                            >
                                <ul className="w-full">
                                    {searchResults.map((result) => (
                                        <li key={result.id} className="w-full">
                                            <button
                                                onClick={() => handleResultClick(result)}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center transition-colors border-b border-gray-100 last:border-0"
                                            >
                                                <div className="mr-3 text-red-400 flex-shrink-0">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium truncate">{result.displayText}</div>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                {gpaData.length > 0 && <GpaLineGraph data={gpaData} />}
                {courseData.length > 0 && <CourseDataTable data={courseData} />}
            </main>

            <footer className="py-4 text-center text-gray-500 text-sm border-t border-red-100 mt-auto">
                <p>© 2025 Aggie AI - Help Texas A&M Students Find the Right Classes</p>
            </footer>
        </div>
    );
}