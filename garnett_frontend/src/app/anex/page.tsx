"use client";

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import Navbar from "@/components/Navbar";
import GpaLineGraph from "@/components/GpaLineGraph";
import CourseDataTable from "@/components/CourseDataTable";
import { motion, AnimatePresence } from 'framer-motion';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
});

const heading = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['500', '600', '700'],
    display: 'swap',
});

interface Course {
    code: string;
    name?: string;
}

interface GPARecord {
    term: string;
    instructor: string;
    avg_gpa: number;
}

interface OurCourseData {
    term: string;
    instructor: string;
    total: number;
    a: number;
    b: number;
    c: number;
    d: number;
    f: number;
    q: number;
    i: number;
    s: number;
    u: number;
    x: number;
    average_gpa: number;
    rmp_link?: string;
    [key: string]: string | number | null | undefined;
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
    const [gpaData, setGpaData] = useState<GPARecord[]>([]);
    const [courseData, setCourseData] = useState<OurCourseData[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
    const [selectedSeasons, setSelectedSeasons] = useState<string[]>(['SPRING', 'SUMMER', 'FALL']);
    const [dataLoading, setDataLoading] = useState(false);
    const [initialCourse, setInitialCourse] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const courseParam = urlParams.get('course');
            if (courseParam) {
                setInitialCourse(courseParam);
                setSearchTerm(courseParam);
                handleUrlCourseSearch(courseParam);
            }
        }
    }, []);

    const handleUrlCourseSearch = async (courseCode: string) => {
        try {
            setShowResults(false);
            setDataLoading(true);
            setSearchTerm(courseCode);
            setGpaData([]);
            setCourseData([]);

            const cleanCourseCode = courseCode.replace(/\s+/g, '');
            const [gpaRes, courseDataRes] = await Promise.all([
                fetch(`/api/get_gpa_by_term?course=${cleanCourseCode}`),
                fetch(`/api/get_course_data?course=${cleanCourseCode}`)
            ]);

            const gpaJson = await gpaRes.json();
            const courseJson = await courseDataRes.json();

            const gpaDataFromResponse = gpaJson.data || [];
            const courseDataFromResponse = courseJson.data || [];

            setGpaData(gpaDataFromResponse);
            setCourseData(courseDataFromResponse);

            const instructors = [...new Set(gpaDataFromResponse.map((d: GPARecord) => d.instructor))].map(
                instructor => String(instructor)
            );
            setSelectedInstructors(instructors);
            setDataLoading(false);
        } catch (error) {
            console.error('Error in handleUrlCourseSearch:', error);
            setDataLoading(false);
            setError('Failed to load course data. Please try again later.');
        }
    };

    useEffect(() => {
        async function fetchCourses() {
            try {
                setLoading(true);
                setError(null);
                const coursesResponse = await fetch('/api/fetch_courses');
                if (!coursesResponse.ok) throw new Error('Failed to fetch courses');
                const coursesData = await coursesResponse.json();
                setCourses(coursesData.courses || []);
            } catch (err) {
                console.error('Error fetching courses:', err);
                setError('Failed to load course list. Please try again later.');
            } finally {
                setLoading(false);
            }
        }
        fetchCourses();
    }, []);

    const triggerSearch = async (courseCode: string) => {
        await handleUrlCourseSearch(courseCode);
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const term = searchTerm.toLowerCase().replace(/\s+/g, '');
        const matchingCourses = courses
            .filter(course => course.code.toLowerCase().replace(/\s+/g, '').includes(term))
            .map(course => ({
                id: `course-${course.code}`,
                type: 'course' as const,
                displayText: course.code,
                original: course
            }));

        matchingCourses.sort((a, b) => {
            const aD = a.displayText.toLowerCase().replace(/\s+/g, '');
            const bD = b.displayText.toLowerCase().replace(/\s+/g, '');
            const aS = aD.startsWith(term);
            const bS = bD.startsWith(term);
            if (aS && !bS) return -1;
            if (!aS && bS) return 1;
            return a.displayText.localeCompare(b.displayText);
        });

        setSearchResults(matchingCourses.slice(0, 10));
        setShowResults(matchingCourses.length > 0);
    }, [searchTerm, courses]);

    const filteredGpaData = gpaData.filter(item => {
        const termParts = item.term.split(' ');
        const season = termParts[0];
        return selectedSeasons.includes(season);
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length >= 2) setShowResults(true);
    };

    const toggleSeason = (season: string) => {
        if (selectedSeasons.includes(season)) {
            if (selectedSeasons.length > 1) {
                setSelectedSeasons(prev => prev.filter(s => s !== season));
            }
        } else {
            setSelectedSeasons(prev => [...prev, season]);
        }
    };

    const toggleAllSeasons = () => {
        const allSeasons = ['SPRING', 'SUMMER', 'FALL'];
        if (selectedSeasons.length === allSeasons.length) {
            setSelectedSeasons(['SPRING']);
        } else {
            setSelectedSeasons(allSeasons);
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.length >= 2) {
            e.preventDefault();
            const cleanedSearchTerm = searchTerm.replace(/\s+/g, '');
            let matchingCourse = null;
            if (courses.length > 0) {
                matchingCourse = courses
                    .filter(course => course.code.toLowerCase().includes(cleanedSearchTerm.toLowerCase()))
                    .sort((a, b) => {
                        const aS = a.code.toLowerCase().startsWith(cleanedSearchTerm.toLowerCase());
                        const bS = b.code.toLowerCase().startsWith(cleanedSearchTerm.toLowerCase());
                        if (aS && !bS) return -1;
                        if (!aS && bS) return 1;
                        return a.code.localeCompare(b.code);
                    })[0];
            }
            const courseToSearch = matchingCourse ? matchingCourse.code : cleanedSearchTerm;
            await triggerSearch(courseToSearch);
        }
    };

    const handleResultClick = async (result: SearchResult) => {
        await triggerSearch(result.displayText);
    };

    const toggleInstructor = (instructor: string) => {
        let newSelected: string[];
        if (selectedInstructors.includes(instructor)) {
            newSelected = selectedInstructors.length === 1
                ? [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))]
                : selectedInstructors.filter(i => i !== instructor);
        } else {
            newSelected = [...selectedInstructors, instructor];
        }
        setSelectedInstructors(newSelected);
    };

    const toggleAllInstructors = () => {
        if (courseData.length === 0) return;
        const allInstructors = [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))];
        if (selectedInstructors.length === allInstructors.length) {
            setSelectedInstructors([]);
        } else {
            setSelectedInstructors(allInstructors);
        }
    };

    return (
        <>
            <Script src="https://www.googletagmanager.com/gtag/js?id=G-37V4PK7JL4" strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">
                {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-37V4PK7JL4');`}
            </Script>

            <div className={`flex flex-col min-h-screen bg-[#f7f5f3] ${inter.className}`}>
                <Navbar conversationStarted={false} />

                <main className="flex-grow flex flex-col items-center px-4">
                    {/* Search section */}
                    <div className="w-full max-w-2xl mx-auto mt-4 relative" ref={searchContainerRef}>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Search courses..."
                                className="w-full p-4 pr-14 rounded-xl bg-white border border-[#C5C5C5] text-black placeholder:text-[#999] focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/10 outline-none transition-all text-lg"
                                disabled={dataLoading}
                            />
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                {dataLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-[#800020]" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mt-3 p-3 bg-white text-[#800020] rounded-xl text-sm border border-[#C5C5C5]">
                                {error}
                            </div>
                        )}

                        {loading && !dataLoading && (
                            <div className="mt-2 text-xs text-[#888] text-center">Loading course list...</div>
                        )}

                        <AnimatePresence>
                            {showResults && searchResults.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg border border-[#C5C5C5] overflow-hidden max-h-[350px] overflow-y-auto"
                                >
                                    <ul>
                                        {searchResults.map((result) => (
                                            <li key={result.id}>
                                                <button
                                                    onClick={() => handleResultClick(result)}
                                                    className="w-full text-left px-4 py-3 hover:bg-[#f7f5f3] flex items-center transition-colors border-b border-[#C5C5C5]/30 last:border-0"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-3 text-[#800020] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                    <span className="font-medium text-black">{result.displayText}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Welcome message */}
                    <AnimatePresence>
                        {!gpaData.length && !courseData.length && !error && !dataLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-2xl mx-auto mt-10 px-6 py-10 bg-white border border-[#C5C5C5] rounded-xl text-center"
                            >
                                <h2 className={`text-3xl font-bold text-[#800020] mb-3 ${heading.className}`}>
                                    Find Your Perfect Class
                                </h2>
                                <p className="text-base text-[#444] mb-6">
                                    Search any Texas A&M course to view professors, grade distributions, and Rate My Professor links.
                                </p>
                                <div className="inline-flex items-center gap-2 text-sm text-[#888] bg-[#f7f5f3] border border-[#C5C5C5] px-4 py-2 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Try CSCE121, MATH151, or ENGR102
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Filters */}
                    <AnimatePresence>
                        {courseData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full max-w-5xl mx-auto mt-6"
                            >
                                {/* Season Filter */}
                                <div className="bg-white border border-[#C5C5C5] rounded-xl p-4 mb-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-sm font-semibold text-black">Term Filter</h3>
                                        <button
                                            onClick={toggleAllSeasons}
                                            className="text-xs text-[#888] font-medium px-2 py-1 rounded-lg hover:bg-[#f7f5f3] transition-colors"
                                        >
                                            {selectedSeasons.length === 3 ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        {['SPRING', 'SUMMER', 'FALL'].map((season) => (
                                            <button
                                                key={season}
                                                onClick={() => toggleSeason(season)}
                                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex-1 ${
                                                    selectedSeasons.includes(season)
                                                        ? 'bg-[#800020] text-white'
                                                        : 'bg-[#f7f5f3] text-black border border-[#C5C5C5] hover:border-[#800020]'
                                                }`}
                                            >
                                                {season}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Instructor Filter */}
                                <div className="bg-white border border-[#C5C5C5] rounded-xl p-4 mb-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-sm font-semibold text-black">Instructor Filter</h3>
                                        <button
                                            onClick={toggleAllInstructors}
                                            className="text-xs text-[#888] font-medium px-2 py-1 rounded-lg hover:bg-[#f7f5f3] transition-colors"
                                        >
                                            {selectedInstructors.length === [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))].length
                                                ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))].map((instructor) => (
                                            <button
                                                key={instructor}
                                                onClick={() => toggleInstructor(instructor)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                                    selectedInstructors.includes(instructor)
                                                        ? 'bg-[#800020] text-white'
                                                        : 'bg-[#f7f5f3] text-black border border-[#C5C5C5] hover:border-[#800020]'
                                                }`}
                                            >
                                                {instructor}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* GPA Graph */}
                    <AnimatePresence>
                        {gpaData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full max-w-5xl mx-auto"
                            >
                                <GpaLineGraph data={filteredGpaData} selectedInstructors={selectedInstructors} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Course Data Table */}
                    <AnimatePresence>
                        {courseData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full max-w-5xl mx-auto"
                            >
                                <CourseDataTable
                                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                    data={courseData.filter((row: OurCourseData) =>
                                        selectedInstructors.includes(String(row.instructor)) &&
                                        selectedSeasons.includes(row.term.split(' ')[0])
                                    ) as any}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                <footer className="py-3 text-center text-[#888] text-xs border-t border-[#C5C5C5]/40 mt-auto">
                    <p>&copy; 2025 Aggie AI &mdash; Texas A&M Course & Professor Insights</p>
                </footer>
            </div>
        </>
    );
}
