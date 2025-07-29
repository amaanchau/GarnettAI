import { motion } from 'framer-motion';
import Link from 'next/link';

interface CourseLinkCardProps {
  courseCode: string;
  isVisible: boolean;
}

export default function CourseLinkCard({ courseCode, isVisible }: CourseLinkCardProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mt-3 mb-4"
    >
      <Link 
        href={`/anex?course=${encodeURIComponent(courseCode)}`}
        className="block"
      >
        <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-red-300 group">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-red-500 text-white p-2 rounded-lg group-hover:bg-red-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 group-hover:text-red-700 transition-colors">
                  View {courseCode} Details
                </h3>
                <p className="text-sm text-gray-600">
                  See professor ratings, grade distributions, and more
                </p>
              </div>
            </div>
            <div className="text-red-400 group-hover:text-red-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
} 