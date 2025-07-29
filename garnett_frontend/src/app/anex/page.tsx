// First, let's update the AnexPage.tsx file to add the season filter functionality

"use client";

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
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

// Define GPA data structure
interface GPARecord {
    term: string;
    instructor: string; // Explicitly typed as string
    avg_gpa: number;
}

// Define our own course data structure - with "Our" prefix to avoid name conflicts
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
    const [courseData, setCourseData] = useState<OurCourseData[]>([]); // Using our renamed interface
    // Add state for selected instructors here, will be shared with both components
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
    // Add state for selected seasons
    const [selectedSeasons, setSelectedSeasons] = useState<string[]>(['SPRING', 'SUMMER', 'FALL']);
    // Add loading state for data load animation
    const [dataLoading, setDataLoading] = useState(false);
    // Add state for URL course parameter
    const [initialCourse, setInitialCourse] = useState<string | null>(null);

    // Handle URL parameters immediately on mount
    useEffect(() => {
        console.log('🔍 URL parameter detection useEffect running');
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const courseParam = urlParams.get('course');
            console.log('📋 URL params:', window.location.search);
            console.log('🎯 Course param found:', courseParam);
            
            if (courseParam) {
                console.log('✅ Course parameter detected, triggering search');
                setInitialCourse(courseParam);
                setSearchTerm(courseParam);
                // Trigger search immediately without waiting for course list
                handleUrlCourseSearch(courseParam);
            } else {
                console.log('❌ No course parameter found in URL');
            }
        } else {
            console.log('❌ Window is undefined');
        }
    }, []);

    // Function to handle URL course search (defined before useEffect)
    const handleUrlCourseSearch = async (courseCode: string) => {
        console.log('🔍 handleUrlCourseSearch called with:', courseCode);
        
        try {
            // Hide search results
            setShowResults(false);

            // Set loading state for animations
            setDataLoading(true);
            console.log('📊 Set dataLoading to true');

            // Update search term to the course code
            setSearchTerm(courseCode);
            console.log('📝 Set searchTerm to:', courseCode);

            // Clear previous data
            setGpaData([]);
            setCourseData([]);
            console.log('🗑️ Cleared previous data');

            // Clean course code by removing spaces for API calls
            const cleanCourseCode = courseCode.replace(/\s+/g, '');
            console.log('🌐 Fetching data for course:', courseCode, '(cleaned to:', cleanCourseCode, ')');
            const [gpaRes, courseDataRes] = await Promise.all([
                fetch(`/api/get_gpa_by_term?course=${cleanCourseCode}`),
                fetch(`/api/get_course_data?course=${cleanCourseCode}`)
            ]);

            console.log('📡 API responses received');
            const gpaJson = await gpaRes.json();
            const courseJson = await courseDataRes.json();

            console.log('📊 GPA data:', gpaJson);
            console.log('📋 Course data:', courseJson);

            const gpaDataFromResponse = gpaJson.data || [];
            const courseDataFromResponse = courseJson.data || [];

            console.log('📈 GPA records count:', gpaDataFromResponse.length);
            console.log('📊 Course records count:', courseDataFromResponse.length);

            // Set the data and end loading state
            setGpaData(gpaDataFromResponse);
            setCourseData(courseDataFromResponse);

            // Initialize selected instructors with all instructors from the data
            const instructors = [...new Set(gpaDataFromResponse.map((d: GPARecord) => d.instructor))].map(
                instructor => String(instructor)
            );
            setSelectedInstructors(instructors);
            console.log('👥 Selected instructors:', instructors);

            // End loading state
            setDataLoading(false);
            console.log('✅ handleUrlCourseSearch completed successfully');
            
        } catch (error) {
            console.error('❌ Error in handleUrlCourseSearch:', error);
            setDataLoading(false);
            setError('Failed to load course data. Please try again later.');
        }
    };



    // Fetch courses data on component mount (separate from URL handling)
    useEffect(() => {
        async function fetchCourses() {
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
                console.error('Error fetching courses:', err);
                setError('Failed to load course list. Please try again later.');
            } finally {
                setLoading(false);
            }
        }

        fetchCourses();
    }, []);

    // Function to trigger search for a course (uses same logic as handleUrlCourseSearch)
    const triggerSearch = async (courseCode: string) => {
        await handleUrlCourseSearch(courseCode);
    };

    // Function to load course data
    const loadCourseData = async (courseCode: string) => {
        try {
            setDataLoading(true);
            setError(null);

            // Clear previous data
            setGpaData([]);
            setCourseData([]);

            // Fetch data for the course
            const [gpaRes, courseDataRes] = await Promise.all([
                fetch(`/api/get_gpa_by_term?course=${courseCode}`),
                fetch(`/api/get_course_data?course=${courseCode}`)
            ]);

            const gpaJson = await gpaRes.json();
            const courseJson = await courseDataRes.json();

            const gpaDataFromResponse = gpaJson.data || [];
            const courseDataFromResponse = courseJson.data || [];

            // Set the data
            setGpaData(gpaDataFromResponse);
            setCourseData(courseDataFromResponse);

            // Initialize selected instructors with all instructors from the data
            const instructors = [...new Set(gpaDataFromResponse.map((d: GPARecord) => d.instructor))].map(
                instructor => String(instructor)
            );
            setSelectedInstructors(instructors);

        } catch (err) {
            console.error('Error loading course data:', err);
            setError('Failed to load course data. Please try again later.');
        } finally {
            setDataLoading(false);
        }
    };

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

        // Filter based on search term - remove spaces for comparison
        const term = searchTerm.toLowerCase().replace(/\s+/g, '');

        // Search courses only (works even if courses list is still loading)
        const matchingCourses = courses
            .filter(course =>
                course.code.toLowerCase().replace(/\s+/g, '').includes(term)
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
            const aDisplayWithoutSpaces = a.displayText.toLowerCase().replace(/\s+/g, '');
            const bDisplayWithoutSpaces = b.displayText.toLowerCase().replace(/\s+/g, '');

            const aStartsWithTerm = aDisplayWithoutSpaces.startsWith(term);
            const bStartsWithTerm = bDisplayWithoutSpaces.startsWith(term);

            if (aStartsWithTerm && !bStartsWithTerm) return -1;
            if (!aStartsWithTerm && bStartsWithTerm) return 1;

            // Then alphabetically
            return a.displayText.localeCompare(b.displayText);
        });

        setSearchResults(matchingCourses.slice(0, 10));
        setShowResults(matchingCourses.length > 0);
    }, [searchTerm, courses]);

    // Filter GPA data based on selected seasons
    const filteredGpaData = gpaData.filter(item => {
        const termParts = item.term.split(' ');
        const season = termParts[0];
        return selectedSeasons.includes(season);
    });

    // Updated handleSearchChange function
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length >= 2) {
            setShowResults(true);
        }
    };

    // Toggle season filter
    const toggleSeason = (season: string) => {
        if (selectedSeasons.includes(season)) {
            // Don't allow removing the last season
            if (selectedSeasons.length > 1) {
                setSelectedSeasons(prev => prev.filter(s => s !== season));
            }
        } else {
            setSelectedSeasons(prev => [...prev, season]);
        }
    };

    // Toggle all seasons
    const toggleAllSeasons = () => {
        const allSeasons = ['SPRING', 'SUMMER', 'FALL'];
        if (selectedSeasons.length === allSeasons.length) {
            // Keep at least one season selected
            setSelectedSeasons(['SPRING']);
        } else {
            setSelectedSeasons(allSeasons);
        }
    };

    // Replace the existing handleKeyDown function with this one:
    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.length >= 2) {
            e.preventDefault();

            // Remove spaces from the search term
            const cleanedSearchTerm = searchTerm.replace(/\s+/g, '');

            // Try to find a matching course in the loaded courses list
            let matchingCourse = null;
            if (courses.length > 0) {
                matchingCourse = courses
                    .filter(course => course.code.toLowerCase().includes(cleanedSearchTerm.toLowerCase()))
                    .sort((a, b) => {
                        // Sort exact matches to the top
                        const aStartsWithTerm = a.code.toLowerCase().startsWith(cleanedSearchTerm.toLowerCase());
                        const bStartsWithTerm = b.code.toLowerCase().startsWith(cleanedSearchTerm.toLowerCase());

                        if (aStartsWithTerm && !bStartsWithTerm) return -1;
                        if (!aStartsWithTerm && bStartsWithTerm) return 1;

                        // Then alphabetically
                        return a.code.localeCompare(b.code);
                    })[0];
            }

            // If no matching course found in loaded list, use the search term directly
            const courseToSearch = matchingCourse ? matchingCourse.code : cleanedSearchTerm;

            // Use the triggerSearch function
            await triggerSearch(courseToSearch);
        }
    };

    const handleResultClick = async (result: SearchResult) => {
        // Use the triggerSearch function
        await triggerSearch(result.displayText);
    };

    // Handle toggling instructor visibility for both table and graph
    const toggleInstructor = (instructor: string) => {
        let newSelected: string[];

        if (selectedInstructors.includes(instructor)) {
            // Remove if only one selected, otherwise filter it out
            newSelected = selectedInstructors.length === 1
                ? [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))]
                : selectedInstructors.filter(i => i !== instructor);
        } else {
            newSelected = [...selectedInstructors, instructor];
        }

        setSelectedInstructors(newSelected);
    };

    // Handle select/unselect all instructors
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
            {/* Google tag (gtag.js) */}
            <Script
                src="https://www.googletagmanager.com/gtag/js?id=G-37V4PK7JL4"
                strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
                {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-37V4PK7JL4');
            `}
            </Script>

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
                                onKeyDown={handleKeyDown}
                                placeholder="Search courses..."
                                className="w-full p-4 pl-12 rounded-xl border border-red-100 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none transition-all shadow-sm text-lg"
                                disabled={dataLoading}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                {dataLoading ? (
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
                        
                        {/* Course list loading indicator */}
                        {loading && !dataLoading && (
                            <div className="mt-2 text-xs text-gray-500 text-center">
                                Loading course list...
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
                                    className="absolute z-50 mt-2 w-full left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-h-[350px] overflow-y-auto"
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

                    {/* No loading message - just a clean transition */}

                    {/* Add welcome message with animation when no data is shown */}
                    <AnimatePresence>
                        {!gpaData.length && !courseData.length && !error && !dataLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-2xl mx-auto mt-8 px-6 py-8 bg-white rounded-xl shadow-sm border border-red-100 text-center"
                            >
                                <h2 className="text-2xl font-bold text-gray-800 mb-3">
                                    Find Your Perfect Class
                                </h2>
                                <p className="text-lg text-gray-600 mb-6">
                                    Search any Texas A&M course to view professors, their grade distributions, and Rate My Professor links.
                                </p>
                                <div className="flex items-center justify-center">
                                    <div className="bg-red-50 p-3 rounded-lg inline-flex items-center text-red-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-sm font-medium">Try searching for courses like CSCE121, MATH151, or ENGR102</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Filters Section */}
                    <AnimatePresence>
                        {courseData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full mt-6"
                            >
                                {/* Season Filter Buttons */}
                                <div className="mb-5">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-sm font-medium text-gray-600">Term Filter</h3>
                                        <button
                                            onClick={toggleAllSeasons}
                                            className="text-xs text-gray-600 font-medium px-2 py-1 rounded hover:bg-gray-50 
                                        transition-colors duration-150 flex items-center"
                                        >
                                            {selectedSeasons.length === 3 ? (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Clear All
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                    </svg>
                                                    Select All
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        {['SPRING', 'SUMMER', 'FALL'].map((season) => (
                                            <button
                                                key={season}
                                                onClick={() => toggleSeason(season)}
                                                className={`px-4 py-1 text-sm font-medium rounded transition-colors duration-150 flex-1 
                                                ${selectedSeasons.includes(season)
                                                        ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                            >
                                                {season}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Instructor Filter Pills - with simplified styling */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-sm font-medium text-gray-600">Instructor Filter</h3>
                                        <button
                                            onClick={toggleAllInstructors}
                                            className="text-xs text-gray-600 font-medium px-2 py-1 rounded hover:bg-gray-50 
                                        transition-colors duration-150 flex items-center"
                                        >
                                            {selectedInstructors.length === [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))].length ? (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Clear All
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                    </svg>
                                                    Select All
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))].map((instructor) => (
                                            <button
                                                key={instructor}
                                                onClick={() => toggleInstructor(instructor)}
                                                className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-150
                                                ${selectedInstructors.includes(instructor)
                                                        ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                {instructor}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Updated component props to include selectedInstructors and filteredGpaData */}
                    <AnimatePresence>
                        {gpaData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full"
                            >
                                <GpaLineGraph
                                    data={filteredGpaData}
                                    selectedInstructors={selectedInstructors}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {courseData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full"
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

                <footer className="py-4 text-center text-gray-500 text-sm border-t border-red-100 mt-auto">
                    <p>© 2025 Aggie AI - Help Texas A&M Students Find the Right Classes</p>
                </footer>
            </div>
        </>
    );
}