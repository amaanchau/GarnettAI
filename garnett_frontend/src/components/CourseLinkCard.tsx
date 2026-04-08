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
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-500 transition-colors"
    >
      {courseCode}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </Link>
  );
}
