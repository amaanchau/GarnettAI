"use client";

import { useState, useRef, useEffect } from 'react';
import { Inter, Nunito } from 'next/font/google';
import Navbar from "@/components/Navbar";
import { motion } from 'framer-motion';

// Using Inter for a cleaner, more modern look
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

// Using Nunito for headings - simple but distinctive with its rounded edges
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
});

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    console.log("Submitted:", inputValue);
    // Clear the input after submission
    setInputValue('');
  };

  // Sample prompts with icons
  const samplePrompts = [
    {
      text: "Who is the easiest CSCE 221 professor?",
      icon: "👨‍🏫"
    },
    {
      text: "How does Leyk grade in CSCE 221?",
      icon: "📊"
    },
    {
      text: "Which professor is best for a light workload in MATH 151?",
      icon: "📚"
    }
  ];

  const handleSamplePromptClick = (prompt: string) => {
    setInputValue(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`flex flex-col min-h-screen bg-white ${inter.className}`}>
      <Navbar />

      <main className="flex-grow flex flex-col items-center px-4 py-12 max-w-5xl mx-auto">
        {/* Header and description with animation and interactive title */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h1
            className={`text-5xl font-bold text-gray-800 mb-4 tracking-tight inline-block ${nunito.className}`}
            whileHover={{
              scale: 1.05,
              color: '#7A0000', // A darker maroon on hover
              transition: { duration: 0.3 }
            }}
          >
            Aggie AI💡
          </motion.h1>
          <p className="text-lg text-gray-600 max-w-3xl leading-relaxed">
            Ask anything about Texas A&M courses & professors! Get insights on grading, difficulty, and professor ratings using GPA data & Rate My Professor reviews.
          </p>
        </motion.div>

        {/* Sample prompts with staggered animation and pastel maroon accents */}
        <motion.div
          className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, staggerChildren: 0.1 }}
        >
          {samplePrompts.map((prompt, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{
                scale: 1.03,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
              }}
              className="bg-white p-5 rounded-xl border border-red-100 shadow-sm cursor-pointer text-gray-700 flex flex-col hover:border-red-200"
              onClick={() => handleSamplePromptClick(prompt.text)}
            >
              <span className="text-3xl mb-3">{prompt.icon}</span>
              <span>{prompt.text}</span>
              <div className="mt-auto pt-3">
                <div className="h-1 w-16 bg-red-100 rounded-full"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Chat UI container with pastel maroon accents */}
        <motion.div
          className="w-full max-w-3xl bg-white rounded-2xl shadow-lg overflow-hidden border border-red-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {/* Chat messages would go here in a real implementation */}
          <div className="p-8 flex justify-center items-center min-h-[200px]">
            <div className="text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <p className="font-medium">Ask a question to get started!</p>
              <p className="text-sm mt-2">Try one of the example prompts above or ask your own question.</p>
            </div>
          </div>

          {/* Input box with pastel maroon accent and centered button */}
          <div className="border-t border-red-100 p-4">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setIsTyping(e.target.value.length > 0);
                }}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(inputValue.length > 0)}
                placeholder="Howdy, what class can I help you with?"
                className={`w-full py-4 px-5 pr-16 rounded-xl border ${isTyping ? 'border-red-500 ring-2 ring-red-100' : 'border-red-100'} outline-none resize-none overflow-hidden transition-all`}
                style={{ minHeight: '60px', maxHeight: '200px' }}
                rows={1}
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 w-10 h-10 flex items-center justify-center ${inputValue.trim() ? 'bg-red-300 text-white' : 'bg-red-100 text-red-300'} transition-colors`}
                disabled={!inputValue.trim()}
                style={{ lineHeight: 1 }} // Ensure proper centering
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </motion.button>
            </form>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-gray-500 text-sm border-t border-red-100">
        <p>© 2025 Aggie AI - Help Texas A&M Students Find the Right Classes</p>
      </footer>
    </div>
  );
}