"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

type InstructorInfo = {
  instructor: string;
  avg_gpa: number;
  n_sections: number;
};

type CourseSelectorProps = {
  selectedCourses: string[];
  selectedProfessorsByCourse: Record<string, string[]>;
  onCoursesChange: (courses: string[]) => void;
  onProfessorsChange: (profs: Record<string, string[]>) => void;
  maxCourses?: number;
};

const MAX_COURSES = 5;

export default function CourseSelector({
  selectedCourses,
  selectedProfessorsByCourse,
  onCoursesChange,
  onProfessorsChange,
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

  return (
    <div className="w-full space-y-1.5" ref={wrapperRef}>
      {/* Professor panel (above chips so it doesn't push below the textarea) */}
      {expandedCourse && (
        <div className="border border-gray-200 rounded-lg bg-gray-50/60 max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
              {expandedCourse} &mdash; Select professors (optional)
            </span>
            <button
              type="button"
              onClick={() => setExpandedCourse(null)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              aria-label="Close professor panel"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="px-2 pb-2">
            {expandedLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2 px-1">
                <svg
                  className="animate-spin h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading instructors...
              </div>
            ) : expandedInstructors && expandedInstructors.length > 0 ? (
              <div className="space-y-0.5">
                {expandedInstructors.map((inst) => {
                  const checked = expandedProfs.includes(inst.instructor);
                  return (
                    <label
                      key={inst.instructor}
                      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${
                        checked
                          ? "bg-[rgba(128,0,32,0.06)]"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleProfessor(expandedCourse, inst.instructor)
                        }
                        className="rounded border-gray-300 text-[#800020] focus:ring-[#800020] h-3.5 w-3.5"
                      />
                      <span className="font-medium text-gray-700 text-xs">
                        {inst.instructor}
                      </span>
                      <span className="text-[11px] text-gray-400 ml-auto tabular-nums">
                        {inst.avg_gpa.toFixed(2)} GPA &middot; {inst.n_sections} sec
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-2 px-1">
                No instructor data available
              </p>
            )}
          </div>
        </div>
      )}

      {/* Selected course chips */}
      {selectedCourses.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedCourses.map((course) => {
            const isActive = expandedCourse === course;
            const profCount = (selectedProfessorsByCourse[course] ?? []).length;
            return (
              <span
                key={course}
                className={`inline-flex items-center text-xs font-semibold rounded-full border transition-colors ${
                  isActive
                    ? "bg-[#800020] text-white border-[#800020]"
                    : "bg-[rgba(128,0,32,0.06)] text-[#800020] border-[rgba(128,0,32,0.15)]"
                }`}
              >
                {/* Clickable label area toggles professor panel */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(course)}
                  className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-l-full transition-colors ${
                    isActive ? "" : "hover:bg-[rgba(128,0,32,0.08)]"
                  }`}
                  title="Click to select professors"
                >
                  {course}
                  {profCount > 0 && (
                    <span
                      className={`text-[10px] ${
                        isActive ? "text-white/70" : "text-gray-400"
                      }`}
                    >
                      ({profCount})
                    </span>
                  )}
                  {/* Chevron hint */}
                  <svg
                    className={`h-3 w-3 transition-transform ${
                      isActive ? "rotate-180" : ""
                    } ${isActive ? "text-white/60" : "text-gray-400"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {/* X remove button */}
                <button
                  type="button"
                  onClick={() => removeCourse(course)}
                  className={`pr-1.5 pl-0.5 py-1 rounded-r-full transition-colors ${
                    isActive ? "hover:bg-white/20" : "hover:bg-gray-200"
                  }`}
                  aria-label={`Remove ${course}`}
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input (own row, dropdown opens upward) */}
      {selectedCourses.length < maxCourses && (
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none z-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={
              coursesLoading
                ? "Loading courses..."
                : selectedCourses.length === 0
                  ? "Add a course (e.g. CSCE 221)..."
                  : "Add another course..."
            }
            disabled={coursesLoading}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-[#800020] focus:ring-1 focus:ring-[rgba(128,0,32,0.1)] outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
          />

          {/* Dropdown — opens upward so it doesn't clip off-screen */}
          {showDropdown && !coursesLoading && filteredCourses.length > 0 && (
            <div className="absolute z-50 bottom-full mb-1 left-0 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
              {filteredCourses.map((course) => {
                const isSelected = selectedCourses.includes(course);
                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => !isSelected && addCourse(course)}
                    disabled={isSelected}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                        : "hover:bg-[rgba(128,0,32,0.04)] text-gray-700"
                    }`}
                  >
                    <span className="font-medium">{course}</span>
                    {isSelected && (
                      <span className="ml-2 text-xs text-gray-400">
                        (selected)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
