"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { Inter, Cormorant_Garamond } from 'next/font/google';
import Navbar from "@/components/Navbar";
import GpaLineGraph from "@/components/GpaLineGraph";
import CourseDataTable from "@/components/CourseDataTable";
import { motion, AnimatePresence } from 'framer-motion';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap' });

function TypewriterText({ text, className }: { text: string; className?: string }) {
    const [displayed, setDisplayed] = useState('');
    const [key, setKey] = useState(0);

    useEffect(() => {
        setDisplayed('');
        setKey((k) => k + 1);
    }, [text]);

    useEffect(() => {
        if (displayed.length >= text.length) return;
        const timeout = setTimeout(() => {
            setDisplayed(text.slice(0, displayed.length + 1));
        }, 35);
        return () => clearTimeout(timeout);
    }, [displayed, text, key]);

    return (
        <span className={className}>
            {displayed}
            {displayed.length < text.length && (
                <span className="inline-block w-[2px] h-[1em] bg-[#800020] ml-0.5 animate-pulse align-middle" />
            )}
        </span>
    );
}

interface Course { code: string; name?: string; }

interface GPARecord { term: string; instructor: string; avg_gpa: number; }

interface OurCourseData {
    term: string; instructor: string; total: number;
    a: number; b: number; c: number; d: number; f: number;
    q: number; i: number; s: number; u: number; x: number;
    average_gpa: number; rmp_link?: string;
    [key: string]: string | number | null | undefined;
}

interface ProfessorResult {
    instructor: string;
    department: string | null;
    rmp_link: string | null;
}

interface ProfessorCourseStats {
    course: string;
    table_name: string;
    instructor: string;
    avg_gpa: number | null;
    sections_count: number;
    terms_count: number;
    latest_term: string;
    total_students: number;
    total_a: number;
    total_b: number;
    total_c: number;
    total_d: number;
    total_f: number;
}

interface ProfessorOverview {
    instructor: string;
    rmp_link: string | null;
    department: string | null;
    courses: ProfessorCourseStats[];
}

interface RmpProfile {
    name?: string;
    rating?: string;
    difficulty?: string;
    would_take_again?: string;
    total_ratings?: string;
    top_tags?: string[];
    url?: string;
    error?: string;
}

type SearchResult = {
    id: string;
    type: 'course' | 'professor';
    displayText: string;
    subtitle?: string;
    original: Course | ProfessorResult;
};

type ViewMode = 'idle' | 'course' | 'professor';

export default function AnexPage() {
    return (
        <Suspense>
            <AnexPageInner />
        </Suspense>
    );
}

function AnexPageInner() {
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const searchContainerRef = useRef<HTMLDivElement | null>(null);

    // Course mode state
    const [gpaData, setGpaData] = useState<GPARecord[]>([]);
    const [courseData, setCourseData] = useState<OurCourseData[]>([]);
    const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
    const [selectedSeasons, setSelectedSeasons] = useState<string[]>(['SPRING', 'SUMMER', 'FALL']);

    // Professor mode state
    const [professorOverview, setProfessorOverview] = useState<ProfessorOverview | null>(null);
    const [rmpProfile, setRmpProfile] = useState<RmpProfile | null>(null);
    const [rmpLoading, setRmpLoading] = useState(false);

    // Shared state
    const [dataLoading, setDataLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('idle');

    // Professor search debounce
    const profSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Clear helpers ---
    const clearCourseState = useCallback(() => {
        setGpaData([]);
        setCourseData([]);
        setSelectedInstructors([]);
        setSelectedSeasons(['SPRING', 'SUMMER', 'FALL']);
    }, []);

    const clearProfessorState = useCallback(() => {
        setProfessorOverview(null);
        setRmpProfile(null);
        setRmpLoading(false);
    }, []);

    // --- URL param handling (reactive to client-side navigation) ---
    useEffect(() => {
        const courseParam = searchParams.get('course');
        const professorParam = searchParams.get('professor');
        if (courseParam) {
            setSearchTerm(courseParam);
            loadCourseData(courseParam);
        } else if (professorParam) {
            setSearchTerm(professorParam);
            loadProfessorData(professorParam);
        }
    }, [searchParams]);

    // --- Fetch courses on mount ---
    useEffect(() => {
        async function fetchCourses() {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch('/api/fetch_courses');
                if (!res.ok) throw new Error('Failed to fetch courses');
                const data = await res.json();
                setCourses(data.courses || []);
            } catch (err) {
                console.error('Error fetching courses:', err);
                setError('Failed to load course list.');
            } finally {
                setLoading(false);
            }
        }
        fetchCourses();
    }, []);

    // --- Load course data (existing flow) ---
    const loadCourseData = async (courseCode: string) => {
        try {
            setShowResults(false);
            setDataLoading(true);
            setError(null);
            setSearchTerm(courseCode);
            clearProfessorState();
            clearCourseState();
            setViewMode('course');

            const clean = courseCode.replace(/\s+/g, '');
            const [gpaRes, courseDataRes] = await Promise.all([
                fetch(`/api/get_gpa_by_term?course=${clean}`),
                fetch(`/api/get_course_data?course=${clean}`)
            ]);

            const gpaJson = await gpaRes.json();
            const courseJson = await courseDataRes.json();

            setGpaData(gpaJson.data || []);
            setCourseData(courseJson.data || []);

            const instructors = [...new Set((gpaJson.data || []).map((d: GPARecord) => d.instructor))].map(String);
            setSelectedInstructors(instructors);
        } catch (err) {
            console.error('Error loading course data:', err);
            setError('Failed to load course data.');
        } finally {
            setDataLoading(false);
        }
    };

    // --- Load professor data ---
    const loadProfessorData = async (instructorName: string) => {
        try {
            setShowResults(false);
            setDataLoading(true);
            setError(null);
            setSearchTerm(instructorName);
            clearCourseState();
            clearProfessorState();
            setViewMode('professor');

            const res = await fetch(`/api/get_professor_courses?instructor=${encodeURIComponent(instructorName)}`);
            const json = await res.json();

            if (json.error) {
                setError(json.error);
                setDataLoading(false);
                return;
            }

            setProfessorOverview({
                instructor: json.instructor,
                rmp_link: json.rmp_link,
                department: json.department,
                courses: json.courses || [],
            });

            if (json.rmp_link) {
                fetchRmpProfile(json.rmp_link);
            }
        } catch (err) {
            console.error('Error loading professor data:', err);
            setError('Failed to load professor data.');
        } finally {
            setDataLoading(false);
        }
    };

    const fetchRmpProfile = async (rmpLink: string) => {
        setRmpLoading(true);
        try {
            const res = await fetch(`/api/get_rmp_profile?url=${encodeURIComponent(rmpLink)}`);
            const json = await res.json();
            if (json.error) {
                setRmpProfile({ url: rmpLink, error: json.error });
            } else {
                setRmpProfile(json as RmpProfile);
            }
        } catch {
            setRmpProfile({ url: rmpLink, error: 'Could not load RMP profile' });
        } finally {
            setRmpLoading(false);
        }
    };

    // --- Click outside ---
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Combined search logic ---
    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const term = searchTerm.toLowerCase().replace(/\s+/g, '');

        // Course matches (local)
        const courseMatches: SearchResult[] = courses
            .filter(c => c.code.toLowerCase().replace(/\s+/g, '').includes(term))
            .map(c => ({
                id: `course-${c.code}`,
                type: 'course' as const,
                displayText: c.code,
                original: c,
            }))
            .sort((a, b) => {
                const aD = a.displayText.toLowerCase().replace(/\s+/g, '');
                const bD = b.displayText.toLowerCase().replace(/\s+/g, '');
                if (aD.startsWith(term) && !bD.startsWith(term)) return -1;
                if (!aD.startsWith(term) && bD.startsWith(term)) return 1;
                return a.displayText.localeCompare(b.displayText);
            })
            .slice(0, 6);

        // Professor matches (API, debounced)
        if (profSearchTimeout.current) clearTimeout(profSearchTimeout.current);
        profSearchTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search_professors?q=${encodeURIComponent(searchTerm)}`);
                const json = await res.json();
                const profMatches: SearchResult[] = (json.professors || []).map((p: ProfessorResult) => ({
                    id: `prof-${p.instructor}`,
                    type: 'professor' as const,
                    displayText: p.instructor,
                    subtitle: p.department || undefined,
                    original: p,
                }));

                const combined = [...courseMatches, ...profMatches].slice(0, 10);
                setSearchResults(combined);
                setShowResults(combined.length > 0);
            } catch {
                setSearchResults(courseMatches.slice(0, 10));
                setShowResults(courseMatches.length > 0);
            }
        }, 200);

        // Show course results immediately
        setSearchResults(courseMatches);
        setShowResults(courseMatches.length > 0);

        return () => {
            if (profSearchTimeout.current) clearTimeout(profSearchTimeout.current);
        };
    }, [searchTerm, courses]);

    // --- Filters ---
    const filteredGpaData = gpaData.filter(item => {
        const season = item.term.split(' ')[0];
        return selectedSeasons.includes(season);
    });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length >= 2) setShowResults(true);
    };

    const toggleSeason = (season: string) => {
        if (selectedSeasons.includes(season)) {
            if (selectedSeasons.length > 1) setSelectedSeasons(prev => prev.filter(s => s !== season));
        } else {
            setSelectedSeasons(prev => [...prev, season]);
        }
    };

    const toggleAllSeasons = () => {
        const all = ['SPRING', 'SUMMER', 'FALL'];
        setSelectedSeasons(selectedSeasons.length === all.length ? ['SPRING'] : all);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.length >= 2) {
            e.preventDefault();
            const clean = searchTerm.replace(/\s+/g, '');
            const match = courses
                .filter(c => c.code.toLowerCase().includes(clean.toLowerCase()))
                .sort((a, b) => {
                    const aS = a.code.toLowerCase().startsWith(clean.toLowerCase());
                    const bS = b.code.toLowerCase().startsWith(clean.toLowerCase());
                    if (aS && !bS) return -1;
                    if (!aS && bS) return 1;
                    return a.code.localeCompare(b.code);
                })[0];
            if (match) {
                await loadCourseData(match.code);
            } else if (searchResults.length > 0) {
                const first = searchResults[0];
                if (first.type === 'course') await loadCourseData(first.displayText);
                else await loadProfessorData(first.displayText);
            }
        }
    };

    const handleResultClick = async (result: SearchResult) => {
        if (result.type === 'course') {
            await loadCourseData(result.displayText);
        } else {
            await loadProfessorData(result.displayText);
        }
    };

    const toggleInstructor = (instructor: string) => {
        if (selectedInstructors.includes(instructor)) {
            const newSelected = selectedInstructors.length === 1
                ? [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))]
                : selectedInstructors.filter(i => i !== instructor);
            setSelectedInstructors(newSelected);
        } else {
            setSelectedInstructors([...selectedInstructors, instructor]);
        }
    };

    const toggleAllInstructors = () => {
        if (courseData.length === 0) return;
        const all = [...new Set(courseData.map((row: OurCourseData) => String(row.instructor)))];
        setSelectedInstructors(selectedInstructors.length === all.length ? [] : all);
    };

    const getGpaColor = (gpa: number | null): string => {
        if (gpa === null) return 'text-[#888]';
        if (gpa >= 3.7) return 'text-green-600';
        if (gpa >= 3.3) return 'text-green-500';
        if (gpa >= 3.0) return 'text-black';
        if (gpa >= 2.7) return 'text-yellow-600';
        if (gpa >= 2.3) return 'text-orange-500';
        return 'text-red-500';
    };

    const hasData = viewMode === 'course' ? (gpaData.length > 0 || courseData.length > 0) : professorOverview !== null;

    return (
        <>
            <Script src="https://www.googletagmanager.com/gtag/js?id=G-37V4PK7JL4" strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">
                {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-37V4PK7JL4');`}
            </Script>

            <div className={`flex flex-col min-h-screen bg-[#f7f5f3] ${inter.className}`}>
                <Navbar conversationStarted={false} />

                <main className="flex-grow flex flex-col items-center px-4">
                    {/* Search */}
                    <div className="w-full max-w-2xl mx-auto mt-4 relative" ref={searchContainerRef}>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Search courses or professors..."
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

                        {/* Search dropdown */}
                        <AnimatePresence>
                            {showResults && searchResults.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-lg border border-[#C5C5C5] overflow-hidden max-h-[400px] overflow-y-auto"
                                >
                                    <ul>
                                        {searchResults.map((result) => (
                                            <li key={result.id}>
                                                <button
                                                    onClick={() => handleResultClick(result)}
                                                    className="w-full text-left px-4 py-3 hover:bg-[#f7f5f3] flex items-center gap-3 transition-colors border-b border-[#C5C5C5]/30 last:border-0"
                                                >
                                                    {result.type === 'course' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#800020] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#444] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-black">{result.displayText}</div>
                                                        {result.subtitle && (
                                                            <div className="text-xs text-[#888] truncate">{result.subtitle}</div>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                                        result.type === 'course'
                                                            ? 'bg-[#800020]/10 text-[#800020]'
                                                            : 'bg-[#444]/10 text-[#444]'
                                                    }`}>
                                                        {result.type}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Welcome */}
                    <AnimatePresence>
                        {!hasData && !error && !dataLoading && viewMode === 'idle' && (
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
                                    Search any Texas A&M course or professor to view grade distributions, GPA trends, and RMP ratings.
                                </p>
                                <div className="inline-flex items-center gap-2 text-sm text-[#888] bg-[#f7f5f3] border border-[#C5C5C5] px-4 py-2 rounded-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Try CSCE121, MATH151, or a professor name
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ===== PROFESSOR MODE ===== */}
                    <AnimatePresence>
                        {viewMode === 'professor' && professorOverview && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full max-w-5xl mx-auto mt-6 space-y-4"
                            >
                                {/* Professor header card */}
                                <div className="bg-white border border-[#C5C5C5] rounded-xl p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <div className="w-10 h-10 rounded-full bg-[#800020] flex items-center justify-center text-white font-bold text-lg">
                                                    {professorOverview.instructor.charAt(0)}
                                                </div>
                                                <div>
                                                    <h2 className={`text-2xl font-bold text-black ${heading.className}`}>
                                                        <TypewriterText text={professorOverview.instructor} />
                                                    </h2>
                                                    {professorOverview.department && (
                                                        <p className="text-sm text-[#888]">{professorOverview.department}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-[#444] mt-2">
                                                Teaches <span className="font-semibold text-black">{professorOverview.courses.length}</span> course{professorOverview.courses.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>

                                        {professorOverview.rmp_link && (
                                            <a
                                                href={professorOverview.rmp_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-white bg-[#800020] hover:bg-[#600018] px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                RateMyProfessor
                                            </a>
                                        )}
                                    </div>

                                    {/* RMP metrics — loads asynchronously after course data */}
                                    {rmpLoading && (
                                        <div className="mt-4 pt-4 border-t border-[#C5C5C5]/40 animate-pulse">
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {[...Array(4)].map((_, i) => (
                                                    <div key={i} className="bg-[#f7f5f3] rounded-lg p-3">
                                                        <div className="h-7 w-12 mx-auto bg-[#e8e5e2] rounded mb-1.5" />
                                                        <div className="h-3 w-20 mx-auto bg-[#e8e5e2] rounded" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {!rmpLoading && rmpProfile && !rmpProfile.error && (
                                        <div className="mt-4 pt-4 border-t border-[#C5C5C5]/40">
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-[#f7f5f3] rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-black">{rmpProfile.rating}</div>
                                                    <div className="text-xs text-[#888] mt-0.5">Overall Rating</div>
                                                </div>
                                                <div className="bg-[#f7f5f3] rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-black">{rmpProfile.difficulty}</div>
                                                    <div className="text-xs text-[#888] mt-0.5">Difficulty</div>
                                                </div>
                                                <div className="bg-[#f7f5f3] rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-black">{rmpProfile.would_take_again}</div>
                                                    <div className="text-xs text-[#888] mt-0.5">Would Take Again</div>
                                                </div>
                                                <div className="bg-[#f7f5f3] rounded-lg p-3 text-center">
                                                    <div className="text-2xl font-bold text-black">{rmpProfile.total_ratings}</div>
                                                    <div className="text-xs text-[#888] mt-0.5">Total Ratings</div>
                                                </div>
                                            </div>
                                            {rmpProfile.top_tags && rmpProfile.top_tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {rmpProfile.top_tags.map((tag) => (
                                                        <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[#800020]/10 text-[#800020] font-medium">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {!rmpLoading && rmpProfile?.error && (
                                        <p className="mt-3 text-xs text-[#888]">RMP profile data unavailable</p>
                                    )}
                                </div>

                                {/* Course cards */}
                                {professorOverview.courses.length === 0 ? (
                                    <div className="bg-white border border-[#C5C5C5] rounded-xl p-8 text-center">
                                        <p className="text-base font-medium text-black">No course data found</p>
                                        <p className="text-sm text-[#888] mt-1">This professor may not have any grade records in our database.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {professorOverview.courses.map((c) => (
                                            <div key={c.course} className="bg-white border border-[#C5C5C5] rounded-xl p-4 hover:border-[#800020]/40 transition-colors">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="font-bold text-black text-lg">{c.course}</h3>
                                                    <span className={`text-lg font-bold ${getGpaColor(c.avg_gpa)}`}>
                                                        {c.avg_gpa !== null ? c.avg_gpa.toFixed(2) : 'N/A'}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                                    <div>
                                                        <span className="text-[#888]">Sections: </span>
                                                        <span className="font-medium text-black">{c.sections_count}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#888]">Terms: </span>
                                                        <span className="font-medium text-black">{c.terms_count}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#888]">Latest: </span>
                                                        <span className="font-medium text-black">{c.latest_term}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[#888]">Students: </span>
                                                        <span className="font-medium text-black">{c.total_students}</span>
                                                    </div>
                                                </div>

                                                {/* Grade bar */}
                                                <div className="mb-3">
                                                    <div className="flex h-2 rounded-full overflow-hidden">
                                                        {(() => {
                                                            const total = c.total_a + c.total_b + c.total_c + c.total_d + c.total_f;
                                                            if (total === 0) return <div className="w-full bg-[#e8e5e2]" />;
                                                            return (
                                                                <>
                                                                    <div className="bg-green-500" style={{ width: `${(c.total_a / total) * 100}%` }} />
                                                                    <div className="bg-green-300" style={{ width: `${(c.total_b / total) * 100}%` }} />
                                                                    <div className="bg-yellow-400" style={{ width: `${(c.total_c / total) * 100}%` }} />
                                                                    <div className="bg-orange-400" style={{ width: `${(c.total_d / total) * 100}%` }} />
                                                                    <div className="bg-red-400" style={{ width: `${(c.total_f / total) * 100}%` }} />
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-[#888] mt-1">
                                                        <span>A: {c.total_a}</span>
                                                        <span>B: {c.total_b}</span>
                                                        <span>C: {c.total_c}</span>
                                                        <span>D: {c.total_d}</span>
                                                        <span>F: {c.total_f}</span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => loadCourseData(c.course)}
                                                    className="w-full text-center text-sm font-medium text-[#800020] bg-[#800020]/5 hover:bg-[#800020]/10 rounded-lg py-2 transition-colors"
                                                >
                                                    Open course details
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ===== COURSE MODE ===== */}
                    {/* Filters */}
                    <AnimatePresence>
                        {viewMode === 'course' && courseData.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full max-w-5xl mx-auto mt-6"
                            >
                                <div className="bg-white border border-[#C5C5C5] rounded-xl p-4 mb-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-sm font-semibold text-black">Term Filter</h3>
                                        <button onClick={toggleAllSeasons} className="text-xs text-[#888] font-medium px-2 py-1 rounded-lg hover:bg-[#f7f5f3] transition-colors">
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

                                <div className="bg-white border border-[#C5C5C5] rounded-xl p-4 mb-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-sm font-semibold text-black">Instructor Filter</h3>
                                        <button onClick={toggleAllInstructors} className="text-xs text-[#888] font-medium px-2 py-1 rounded-lg hover:bg-[#f7f5f3] transition-colors">
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
                        {viewMode === 'course' && gpaData.length > 0 && (
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
                        {viewMode === 'course' && courseData.length > 0 && (
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
