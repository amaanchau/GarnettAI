"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

type InstructorInfo = {
  instructor: string;
  avg_gpa: number;
  n_sections: number;
};

type ProfessorSearchResult = {
  instructor: string;
  department: string | null;
  rmp_link: string | null;
};

type CourseSelectorProps = {
  selectedCourses: string[];
  selectedProfessorsByCourse: Record<string, string[]>;
  selectedStandaloneProfessors: string[];
  onCoursesChange: (courses: string[]) => void;
  onProfessorsChange: (profs: Record<string, string[]>) => void;
  onStandaloneProfessorsChange: (profs: string[]) => void;
  maxCourses?: number;
};

const MAX_COURSES = 5;

export default function CourseSelector({
  selectedCourses,
  selectedProfessorsByCourse,
  selectedStandaloneProfessors,
  onCoursesChange,
  onProfessorsChange,
  onStandaloneProfessorsChange,
  maxCourses = MAX_COURSES,
}: CourseSelectorProps) {
  const [allCourses, setAllCourses] = useState<string[]>([]);
  const [coursesLoading, setCourseLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [instructorsByCourse, setInstructorsByCourse] = useState<
    Record<string, InstructorInfo[]>
  >({});
  const [instructorsLoading, setInstructorsLoading] = useState<
    Record<string, boolean>
  >({});
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [professorResults, setProfessorResults] = useState<ProfessorSearchResult[]>([]);
  const profSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setCourseLoading(true);
    fetch("/api/picker/courses")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.courses)) {
          setAllCourses(data.courses);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCourseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setExpandedCourse(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const fetchInstructors = useCallback(
    async (course: string) => {
      if (instructorsByCourse[course] || instructorsLoading[course]) return;
      setInstructorsLoading((prev) => ({ ...prev, [course]: true }));
      try {
        const res = await fetch(
          `/api/picker/instructors?course=${encodeURIComponent(course)}`
        );
        const data = await res.json();
        if (Array.isArray(data.instructors)) {
          setInstructorsByCourse((prev) => ({
            ...prev,
            [course]: data.instructors,
          }));
        }
      } catch {
        // ignore
      } finally {
        setInstructorsLoading((prev) => ({ ...prev, [course]: false }));
      }
    },
    [instructorsByCourse, instructorsLoading]
  );

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return allCourses.slice(0, 50);
    const q = searchQuery.toUpperCase().replace(/\s+/g, "");
    return allCourses
      .filter((c) => c.replace(/\s+/g, "").includes(q))
      .slice(0, 50);
  }, [allCourses, searchQuery]);

  // Debounced professor search when query looks like a name (contains letters, no leading digits)
  useEffect(() => {
    if (profSearchTimer.current) clearTimeout(profSearchTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2 || /^\d/.test(q)) {
      setProfessorResults([]);
      return;
    }
    // Only search professors if course results are sparse
    if (filteredCourses.length > 5) {
      setProfessorResults([]);
      return;
    }
    profSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search_professors?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (Array.isArray(data.professors)) {
          setProfessorResults(data.professors);
        }
      } catch {
        setProfessorResults([]);
      }
    }, 250);
    return () => {
      if (profSearchTimer.current) clearTimeout(profSearchTimer.current);
    };
  }, [searchQuery, filteredCourses.length]);

  const addStandaloneProfessor = (name: string) => {
    if (selectedStandaloneProfessors.includes(name)) return;
    onStandaloneProfessorsChange([...selectedStandaloneProfessors, name]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const removeStandaloneProfessor = (name: string) => {
    onStandaloneProfessorsChange(selectedStandaloneProfessors.filter((p) => p !== name));
  };

  const addCourse = (course: string) => {
    if (selectedCourses.includes(course) || selectedCourses.length >= maxCourses)
      return;
    onCoursesChange([...selectedCourses, course]);
    setSearchQuery("");
    setShowDropdown(false);
    fetchInstructors(course);
  };

  const removeCourse = (course: string) => {
    onCoursesChange(selectedCourses.filter((c) => c !== course));
    const nextProfs = { ...selectedProfessorsByCourse };
    delete nextProfs[course];
    onProfessorsChange(nextProfs);
    if (expandedCourse === course) setExpandedCourse(null);
  };

  const toggleProfessor = (course: string, instructor: string) => {
    const current = selectedProfessorsByCourse[course] ?? [];
    const next = current.includes(instructor)
      ? current.filter((p) => p !== instructor)
      : [...current, instructor];
    onProfessorsChange({ ...selectedProfessorsByCourse, [course]: next });
  };

  const toggleExpanded = (course: string) => {
    if (expandedCourse === course) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(course);
      fetchInstructors(course);
    }
  };

  const expandedInstructors = expandedCourse
    ? instructorsByCourse[expandedCourse]
    : undefined;
  const expandedLoading = expandedCourse
    ? instructorsLoading[expandedCourse]
    : false;
  const expandedProfs = expandedCourse
    ? selectedProfessorsByCourse[expandedCourse] ?? []
    : [];

  const atMax = selectedCourses.length >= maxCourses;

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {/* Unified tag-input container */}
      <div
        className={`flex flex-wrap items-center gap-1.5 bg-white rounded-xl px-3 py-2 border transition-all min-h-[40px] cursor-text ${
          isFocused
            ? "border-[#800020] ring-2 ring-[#800020]/10"
            : "border-[#C5C5C5]"
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Course tags inline */}
        <AnimatePresence mode="popLayout">
          {selectedCourses.map((course) => {
            const isActive = expandedCourse === course;
            const profCount = (selectedProfessorsByCourse[course] ?? []).length;
            return (
              <motion.span
                key={course}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`inline-flex items-center text-xs font-semibold rounded-lg transition-all select-none ${
                  isActive
                    ? "bg-[#800020] text-white"
                    : "bg-[#f7f5f3] text-black"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(course);
                  }}
                  className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-l-lg transition-colors ${
                    isActive ? "" : "hover:bg-[#eae8e6]"
                  }`}
                  title="Select professors"
                >
                  {course}
                  {profCount > 0 && (
                    <span className={`text-[10px] leading-none px-1 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-[#800020]/10 text-[#800020]"
                    }`}>
                      {profCount}
                    </span>
                  )}
                  <svg
                    className={`h-2.5 w-2.5 transition-transform ${isActive ? "rotate-180 text-white/60" : "text-[#888]"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCourse(course);
                  }}
                  className={`px-1 py-1 rounded-r-lg transition-colors ${
                    isActive ? "hover:bg-white/20" : "hover:bg-[#eae8e6]"
                  }`}
                  aria-label={`Remove ${course}`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.span>
            );
          })}
        </AnimatePresence>

        {/* Standalone professor tags */}
        <AnimatePresence mode="popLayout">
          {selectedStandaloneProfessors.map((prof) => (
            <motion.span
              key={`prof-${prof}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center text-xs font-semibold rounded-lg bg-[#444]/10 text-[#444]"
            >
              <span className="inline-flex items-center gap-1 pl-2 pr-1 py-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {prof}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeStandaloneProfessor(prof);
                }}
                className="px-1 py-1 rounded-r-lg hover:bg-[#444]/10 transition-colors"
                aria-label={`Remove ${prof}`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Inline search input */}
        {!atMax && (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              if (searchQuery || selectedCourses.length === 0) setShowDropdown(true);
            }}
            onBlur={() => setIsFocused(false)}
            placeholder={
              coursesLoading
                ? "Loading..."
                : selectedCourses.length === 0 && selectedStandaloneProfessors.length === 0
                  ? "Add courses or professors..."
                  : "Add course or professor..."
            }
            disabled={coursesLoading}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-black placeholder:text-[#aaa] outline-none py-0.5 disabled:cursor-not-allowed"
          />
        )}
        {atMax && (
          <span className="text-[11px] text-[#888] py-0.5">
            Max {maxCourses} courses
          </span>
        )}
      </div>

      {/* Search dropdown — opens upward */}
      {showDropdown && !coursesLoading && (filteredCourses.length > 0 || professorResults.length > 0) && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-full max-h-52 overflow-y-auto bg-white border border-[#C5C5C5] rounded-xl shadow-lg">
          {filteredCourses.length > 0 && (
            <>
              {professorResults.length > 0 && (
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#888] font-semibold">Courses</span>
                </div>
              )}
              {filteredCourses.map((course) => {
                const isSelected = selectedCourses.includes(course);
                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => !isSelected && addCourse(course)}
                    disabled={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-[#f2f2f2] text-[#aaa] cursor-not-allowed"
                        : "text-black hover:bg-[#f7f5f3]"
                    }`}
                  >
                    <span className="font-medium">{course}</span>
                    {isSelected && (
                      <span className="ml-2 text-xs text-[#aaa]">(added)</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
          {professorResults.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 border-t border-[#C5C5C5]/30">
                <span className="text-[10px] uppercase tracking-wider text-[#888] font-semibold">Professors</span>
              </div>
              {professorResults.map((prof) => {
                const isSelected = selectedStandaloneProfessors.includes(prof.instructor);
                return (
                  <button
                    key={`prof-${prof.instructor}`}
                    type="button"
                    onClick={() => !isSelected && addStandaloneProfessor(prof.instructor)}
                    disabled={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-[#f2f2f2] text-[#aaa] cursor-not-allowed"
                        : "text-black hover:bg-[#f7f5f3]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[#888] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">{prof.instructor}</span>
                    </span>
                    {prof.department && (
                      <span className="ml-2 text-xs text-[#888]">{prof.department}</span>
                    )}
                    {isSelected && (
                      <span className="ml-2 text-xs text-[#aaa]">(added)</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Professor panel — floating below the input */}
      <AnimatePresence>
        {expandedCourse && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-40 bottom-full mb-1 left-0 w-full bg-white border border-[#C5C5C5] rounded-xl shadow-lg max-h-48 overflow-y-auto"
          >
            <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
              <span className="text-[11px] uppercase tracking-wider text-[#888] font-semibold">
                {expandedCourse} Professors
              </span>
              <button
                type="button"
                onClick={() => setExpandedCourse(null)}
                className="text-[#888] hover:text-black p-0.5 transition-colors"
                aria-label="Close"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-2 pb-2">
              {expandedLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#888] py-3 px-1">
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </div>
              ) : expandedInstructors && expandedInstructors.length > 0 ? (
                <div className="space-y-0.5">
                  {expandedInstructors.map((inst) => {
                    const checked = expandedProfs.includes(inst.instructor);
                    return (
                      <label
                        key={inst.instructor}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                          checked ? "bg-[#800020]/5" : "hover:bg-[#f7f5f3]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleProfessor(expandedCourse, inst.instructor)
                          }
                          className="rounded border-[#C5C5C5] text-[#800020] focus:ring-[#800020] h-3.5 w-3.5"
                        />
                        <span className="font-medium text-black text-xs flex-1">
                          {inst.instructor}
                        </span>
                        <span className="text-[11px] text-[#888] tabular-nums">
                          {inst.avg_gpa.toFixed(2)} &middot; {inst.n_sections}s
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#888] py-3 px-1">
                  No instructor data available
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
