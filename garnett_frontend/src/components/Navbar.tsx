"use client";
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Nunito } from 'next/font/google';

const nunito = Nunito({
    subsets: ['latin'],
    weight: ['400', '600', '700'],
    display: 'swap',
});

interface NavbarProps {
    onNewChat?: () => void;
    conversationStarted: boolean;
}

export default function Navbar({ onNewChat, conversationStarted }: NavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleNewChat = () => {
        if (onNewChat) onNewChat();
    };

    useEffect(() => {
        if (!menuRef.current) return;
        if (isMenuOpen) {
            menuRef.current.classList.remove('max-h-0', 'opacity-0');
            menuRef.current.classList.add('max-h-96', 'opacity-100');
        } else {
            menuRef.current.classList.remove('max-h-96', 'opacity-100');
            menuRef.current.classList.add('max-h-0', 'opacity-0');
        }
    }, [isMenuOpen]);

    return (
        <nav className="w-full sticky top-0 z-50 bg-[#f7f5f3]">
            <div className="container mx-auto px-6 py-3 border-b-[1.5px] border-[#C5C5C5]/40">
                <div className="flex justify-between items-center">
                    <div className="hidden md:flex items-center gap-2">
                        <Link href="/" className={`flex items-center gap-3 px-5 py-2.5 text-black font-bold text-xl rounded-xl hover:bg-black/[0.03] transition-colors ${nunito.className}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Aggie AI
                        </Link>
                        <Link href="/anex" className={`flex items-center gap-3 px-5 py-2.5 text-black font-bold text-xl rounded-xl hover:bg-black/[0.03] transition-colors ${nunito.className}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            Anex
                        </Link>
                    </div>

                    <div className="flex items-center">
                        {conversationStarted && (
                            <button
                                onClick={handleNewChat}
                                className={`flex items-center gap-2.5 px-5 py-2.5 text-lg font-semibold text-black rounded-xl hover:bg-black/[0.03] transition-colors ${nunito.className}`}
                                aria-label="Start new chat"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span className="hidden md:inline">New Chat</span>
                            </button>
                        )}
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2.5 text-black rounded-xl hover:bg-black/[0.03] transition-colors"
                            aria-label="Toggle menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                <div
                    ref={menuRef}
                    className="md:hidden overflow-hidden transition-all duration-300 ease-in-out max-h-0 opacity-0"
                >
                    <div className="pt-4 pb-3 border-t border-[#C5C5C5]/40 mt-3 flex flex-col gap-1">
                        <Link href="/" className={`flex items-center gap-3 px-5 py-3 text-black font-bold text-lg rounded-xl hover:bg-black/[0.03] transition-colors ${nunito.className}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Aggie AI
                        </Link>
                        <Link href="/anex" className={`flex items-center gap-3 px-5 py-3 text-black font-bold text-lg rounded-xl hover:bg-black/[0.03] transition-colors ${nunito.className}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            Anex
                        </Link>
                        {conversationStarted && (
                            <button onClick={handleNewChat} className={`flex items-center gap-3 px-5 py-3 text-black font-bold text-lg rounded-xl hover:bg-black/[0.03] transition-colors text-left ${nunito.className}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#800020]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                New Chat
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
