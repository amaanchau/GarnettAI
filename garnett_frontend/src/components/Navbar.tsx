"use client";  // This directive is needed for client-side components in Next.js
import Link from 'next/link';
import { useState } from 'react';
import { Poppins } from 'next/font/google';

// Initialize the Poppins font with medium weight
const poppins = Poppins({
    subsets: ['latin'],
    weight: ['500'], // Using 500 (medium) 
    display: 'swap',
});

export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="w-full">
            <div className="container mx-auto px-4 py-3">
                <div className="flex justify-between items-center">
                    {/* Desktop navigation - now on the left side */}
                    <div className="hidden md:flex items-center space-x-12 font-[family-name:var(--font-geist-sans)]">
                        <Link href="/" className="py-3 px-5 text-2xl font-medium text-gray-600 rounded-xl transition-all duration-300 ease-in-out hover:bg-red-50 hover:text-gray-700 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Aggie AI
                        </Link>
                        <Link href="/anex" className="py-3 px-5 text-2xl font-medium text-gray-600 rounded-xl transition-all duration-300 ease-in-out hover:bg-red-50 hover:text-gray-700 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            Anex
                        </Link>
                    </div>

                    {/* Right side empty space or can be used for something else later */}
                    <div className="hidden md:flex items-center space-x-4">
                        {/* You can add more links or elements here if needed */}
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200 rounded-md"
                            aria-label="Toggle menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <div className="md:hidden pt-8 pb-6 border-t border-gray-100 font-[family-name:var(--font-geist-sans)]">
                        <div className="flex flex-col space-y-4">
                            <Link href="/aggie-ai" className="py-4 px-5 text-xl text-gray-600 rounded transition-colors duration-300 ease-in-out hover:bg-gray-100 hover:text-gray-300 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                Aggie AI
                            </Link>
                            <Link href="/anex" className="py-4 px-5 text-xl text-gray-600 rounded transition-colors duration-300 ease-in-out hover:bg-gray-100 hover:text-gray-300 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                </svg>
                                Anex
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}