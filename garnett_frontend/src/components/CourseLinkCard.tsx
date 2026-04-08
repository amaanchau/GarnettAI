import Link from 'next/link';

interface CourseLinkCardProps {
  courseCode: string;
  isVisible: boolean;
}

export default function CourseLinkCard({ courseCode, isVisible }: CourseLinkCardProps) {
  if (!isVisible) return null;

  return (
    <Link
      href={`/anex?course=${encodeURIComponent(courseCode)}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#800020] hover:text-[#600018] bg-[#800020]/5 hover:bg-[#800020]/10 px-2.5 py-1 rounded-full border border-[#800020]/15 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      {courseCode}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </Link>
  );
}

interface ProfessorLinkCardProps {
  professorName: string;
  isVisible: boolean;
}

export function ProfessorLinkCard({ professorName, isVisible }: ProfessorLinkCardProps) {
  if (!isVisible) return null;

  return (
    <Link
      href={`/anex?professor=${encodeURIComponent(professorName)}`}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#444] hover:text-black bg-[#444]/5 hover:bg-[#444]/10 px-2.5 py-1 rounded-full border border-[#444]/15 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      {professorName}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </Link>
  );
}
