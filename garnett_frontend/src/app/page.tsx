"use client";
import { useState, useRef, useEffect } from 'react';
import { Inter, Nunito } from 'next/font/google';
import Navbar from "@/components/Navbar";
import CourseLinkCard from "@/components/CourseLinkCard";
import { motion } from 'framer-motion';

// Using Inter for a cleaner, more modern look
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

// Using Nunito for headings - simple but distinctive with its rounded edges
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
});

const formatMessage = (content: string) => {
  // Replace markdown-style bold with HTML bold
  const boldFormatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Return as HTML with preserved line breaks
  return { __html: boldFormatted };
};

// Message type definition
type Message = {
  content: string;
  isUser: boolean;
  id?: string;
  hasCourseLink?: boolean;
  courseCode?: string;
  courseCodes?: string[]; // For multiple courses
};

// Session context type
type SessionContext = {
  currentCourse: string | null;
  activeCourses: string[];
};

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext>({
    currentCourse: null,
    activeCourses: []
  });
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Function to handle stopping the current request
  const handleStopRequest = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsStreaming(false);
    setIsLoading(false);
    setStreamingResponse('');
  };

  // Function to handle starting a new chat
  const handleNewChat = () => {
    setMessages([]);
    setConversationStarted(false);
    setInputValue('');
    setIsTyping(false);
    setIsLoading(false);
    setSessionContext({ currentCourse: null, activeCourses: [] }); // Clear all course context

    // Also clear localStorage
    localStorage.removeItem('chatMessages');
    localStorage.removeItem('sessionContext');
    localStorage.removeItem('conversationStarted');

    // Scroll to top if needed
    window.scrollTo(0, 0);
  };

  // Load session data from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    const savedContext = localStorage.getItem('sessionContext');
    const savedConversationState = localStorage.getItem('conversationStarted');

    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    if (savedContext) {
      setSessionContext(JSON.parse(savedContext));
    }

    if (savedConversationState === 'true') {
      setConversationStarted(true);
    }
  }, []);

  // Save session data to localStorage when it changes
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
      localStorage.setItem('conversationStarted', String(conversationStarted));
    }

    if (sessionContext.activeCourses && sessionContext.activeCourses.length > 0) {
      localStorage.setItem('sessionContext', JSON.stringify(sessionContext));
    }
  }, [messages, sessionContext, conversationStarted]);

  // Auto-resize the textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Scroll to bottom of chat when messages or streaming response changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, streamingResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    const userMessage = inputValue;

    // Mark conversation as started after first message
    if (!conversationStarted) {
      setConversationStarted(true);
    }

    // Add user message to chat
    setMessages(prev => [...prev, { content: userMessage, isUser: true }]);

    // Clear the input after submission
    setInputValue('');

    // Set loading and streaming state
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingResponse('');

    try {
      // Create AbortController for this request
      const controller = new AbortController();
      setAbortController(controller);

      // Get last 10 messages for context
      const conversationHistory = messages.slice(-8);

      // Create fetch request to the API endpoint with streaming
      const response = await fetch('/api/answer_with_rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          conversationHistory: conversationHistory,
          sessionContext: sessionContext,
          useStreaming: true
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body available');
      }

      let accumulatedResponse = '';
      let finalSessionContext = sessionContext;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'status':
                  // Ignore status updates - we removed progress display
                  break;

                case 'chunk':
                  accumulatedResponse += data.content;
                  // Add delay to control streaming speed
                  await new Promise(resolve => setTimeout(resolve, 55)); // 50ms delay - adjust this value
                  setStreamingResponse(accumulatedResponse);
                  break;

                case 'complete':
                  accumulatedResponse = data.answer;
                  setStreamingResponse(accumulatedResponse);
                  finalSessionContext = data.sessionContext;
                  
                  // Add final complete message to chat
                  setMessages(prev => [...prev, {
                    content: data.answer,
                    isUser: false,
                    id: Date.now().toString(),
                    hasCourseLink: data.sessionContext?.activeCourses?.length > 0,
                    courseCode: data.sessionContext?.activeCourses?.[0],
                    courseCodes: data.sessionContext?.activeCourses || []
                  }]);

                  // Update session context
                  if (data.sessionContext) {
                    setSessionContext(data.sessionContext);
                  }
                  break;

                case 'error':
                  throw new Error(data.error);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE message:', line);
            }
          }
        }
      }

    } catch (error) {
      console.error("API Error:", error);
      
      // Check if the error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user');
        // Don't add error message for user-initiated aborts
      } else {
        // Handle other exceptions
        setMessages(prev => [...prev, {
          content: "Whoop! We're having trouble connecting right now. Please try again later.",
          isUser: false,
          id: Date.now().toString(),
          hasCourseLink: false,
          courseCodes: []
        }]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingResponse('');
      setAbortController(null);
    }
  };

  // Sample prompts with icons
  const samplePrompts = [
    {
      text: "Who is the easiest CSCE 221 professor?",
      icon: "👨‍🏫"
    },
    {
      text: "How does Larry May grade in PHYS 206?",
      icon: "📊"
    },
    {
      text: "Which professor is best for a light workload in MATH 151?",
      icon: "📚"
    }
  ];

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
    // Shift+Enter will add a new line naturally without additional code
  };

  const handleSamplePromptClick = (prompt: string) => {
    setInputValue(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`flex flex-col min-h-screen bg-white ${inter.className} font-medium`}>
      <Navbar onNewChat={handleNewChat} conversationStarted={conversationStarted} />

      <main className={`flex-grow flex flex-col items-center ${conversationStarted ? 'w-full p-0 mt-10' : 'px-4 py-6'}`}>
        {/* Current Course Indicator - Show when context is active */}
        {conversationStarted && sessionContext.activeCourses && sessionContext.activeCourses.length > 0 && (
          <div className="w-full max-w-7xl mx-auto px-4 absolute top-22 z-10">
            <div className="glass px-4 py-2 rounded-xl text-[#800020] text-sm inline-flex items-center border border-[rgba(128,0,32,0.1)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {sessionContext.activeCourses.length === 1 ? (
                <>Current course: <span className="font-bold ml-1">{sessionContext.activeCourses[0]}</span></>
              ) : (
                <>
                  Active courses:
                  <span className="font-bold ml-1">
                    {sessionContext.activeCourses.map((course, index) => (
                      <span key={course}>
                        {course}
                        {index < sessionContext.activeCourses.length - 1 && ", "}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
          </div>
        )}


        {/* Header and intro section - only show if conversation hasn't started */}
        {!conversationStarted && (
          <>
            <motion.div
              className="text-center mb-6 max-w-5xl mx-auto"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h1
                className={`text-5xl font-bold text-[#800020] mb-4 tracking-tight inline-block ${nunito.className}`}
                whileHover={{
                  scale: 1.05,
                  color: '#600018', // A darker maroon on hover
                  transition: { duration: 0.3 }
                }}
              >
                Aggie AI💡
              </motion.h1>
              <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
                Ask anything about Texas A&M courses & professors! Get insights on grading, difficulty, and professor ratings using GPA data & Rate My Professor reviews.
              </p>
            </motion.div>

            <motion.div
              className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
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
                    boxShadow: "0 16px 40px rgba(128, 0, 32, 0.15)"
                  }}
                  className="card-modern p-6 cursor-pointer text-gray-700 flex flex-col glass-hover"
                  onClick={() => handleSamplePromptClick(prompt.text)}
                >
                  <span className="text-3xl mb-3">{prompt.icon}</span>
                  <span className="text-base">{prompt.text}</span>
                  <div className="mt-auto pt-3">
                    <div className="h-1 w-16 maroon-gradient rounded-full"></div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* Adjust chat container size based on whether conversation has started */}
        <motion.div
          className={`w-full flex flex-col ${conversationStarted
            ? 'flex-grow border-none'
            : 'max-w-3xl rounded-2xl overflow-hidden card-modern'
            }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{ minHeight: conversationStarted ? '70vh' : '300px' }}
        >
          {/* Chat messages */}
          <div
            ref={chatContainerRef}
            className={`flex-grow overflow-y-auto ${conversationStarted ? 'w-full mx-auto' : 'p-4'}`}
            style={{
              maxHeight: conversationStarted ? 'calc(100vh - 200px)' : 'calc(100vh - 350px)',
              minHeight: conversationStarted ? '60vh' : '250px'
            }}
          >
            {messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  <p className="font-medium text-lg">Ask a question to get started!</p>
                  <p className="text-base mt-2">Try one of the example prompts above or ask your own question.</p>
                </div>
              </div>
            ) : (
              <div className={conversationStarted ? "w-full max-w-7xl mx-auto px-4 mt-1" : ""}>
                {messages.map((message, index) => (
                  <div key={index}>
                    <div
                      className={`mb-4 flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`p-3 rounded-xl inline-block max-w-[1000px] text-lg ${message.isUser
                          ? 'bg-gray-50 text-gray-800'
                          : 'bg-white text-gray-800 rounded-tl-none'
                          }`}
                        dangerouslySetInnerHTML={formatMessage(message.content)}
                        style={{ whiteSpace: 'pre-line' }}
                      />
                    </div>
                    {/* Show course link cards for AI responses when courses are detected */}
                    {!message.isUser && message.hasCourseLink && message.courseCodes && message.courseCodes.length > 0 && (
                      <div className="flex justify-start mb-4">
                        <div className="w-full max-w-[1000px] space-y-3">
                          {message.courseCodes.map((courseCode, courseIndex) => (
                            <CourseLinkCard 
                              key={`${message.id}-course-${courseIndex}`}
                              courseCode={courseCode} 
                              isVisible={true} 
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Streaming response display */}
            {isStreaming && (
              <div className={conversationStarted ? "w-full max-w-7xl mx-auto px-4" : ""}>
                <div className="flex mb-4 justify-start w-full">
                  <div className="p-3 rounded-xl rounded-tl-none bg-white text-gray-800 max-w-[1000px] text-lg">
                    {/* Streaming text */}
                    {streamingResponse ? (
                      <div style={{ whiteSpace: 'pre-line' }}>
                        <span dangerouslySetInnerHTML={formatMessage(streamingResponse)} />
                        <span className="inline-block w-0.5 h-6 bg-gray-800 animate-pulse ml-0.5"></span>
                      </div>
                    ) : (
                      /* Simple typing indicator while waiting for response */
                      <div className="flex items-center text-gray-500">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Stop indicator */}
                <div className="flex justify-start mb-2">
                  <div className="text-xs text-gray-500 flex items-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse mr-2"></div>
                    Generating response... Click the stop button to cancel
                  </div>
                </div>
                {/* Show course link cards for streaming responses when courses are detected */}
                {sessionContext.activeCourses && sessionContext.activeCourses.length > 0 && (
                  <div className="flex justify-start mb-4">
                    <div className="w-full max-w-[1000px] space-y-3">
                      {sessionContext.activeCourses.map((courseCode, courseIndex) => (
                        <CourseLinkCard 
                          key={`streaming-course-${courseIndex}`}
                          courseCode={courseCode} 
                          isVisible={true} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Fallback loading indicator for non-streaming */}
            {isLoading && !isStreaming && (
              <div className={conversationStarted ? "w-full max-w-7xl mx-auto px-4" : ""}>
                <div className="flex mb-4 justify-start w-full">
                  <div className="p-3 rounded-xl rounded-tl-none flex items-center inline-block">
                    <div className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input box with glass effect and maroon accent */}
          <div className={`border-t ${conversationStarted ? 'border-gray-200' : 'border-[rgba(128,0,32,0.1)]'} p-4 mt-auto glass`}>
            <form onSubmit={handleSubmit} className={`relative ${conversationStarted ? 'max-w-7xl mx-auto w-full' : ''}`}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setIsTyping(e.target.value.length > 0);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(inputValue.length > 0)}
                placeholder={
                  isStreaming
                    ? "Please wait for the current response to complete..."
                    : sessionContext.activeCourses && sessionContext.activeCourses.length > 0
                    ? sessionContext.activeCourses.length === 1
                      ? `Ask about ${sessionContext.activeCourses[0]}...`
                      : `Ask about ${sessionContext.activeCourses[0]} and ${sessionContext.activeCourses.length - 1} other course${sessionContext.activeCourses.length > 2 ? 's' : ''}...`
                    : "Howdy, what class can I help you with?"
                }
                className={`w-full py-4 px-5 pr-16 rounded-xl border text-lg ${isTyping ? 'border-[#800020] ring-2 ring-[rgba(128,0,32,0.1)]' : 'border-[rgba(128,0,32,0.1)]'} outline-none resize-none overflow-hidden transition-all ${isStreaming ? 'bg-gray-50 cursor-not-allowed' : 'input-modern'}`}
                style={{ minHeight: '60px', maxHeight: '200px' }}
                rows={1}
                disabled={isLoading || isStreaming}
              />
              
              {/* Stop button - appears during streaming */}
              {isStreaming && (
                <motion.button
                  type="button"
                  onClick={handleStopRequest}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 w-10 h-10 flex items-center justify-center maroon-gradient text-white hover:shadow-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              )}
              {/* Submit button - hidden during streaming */}
              {!isStreaming && (
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 w-10 h-10 flex items-center justify-center ${inputValue.trim() && !isLoading ? 'maroon-gradient text-white' : 'bg-[rgba(128,0,32,0.1)] text-[#800020]'
                    } transition-all`}
                  disabled={!inputValue.trim() || isLoading}
                  style={{ lineHeight: 1 }} // Ensure proper centering
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </motion.button>
              )}
            </form>
          </div>
        </motion.div>
      </main>

      {!conversationStarted && (
        <footer className="py-2 text-center text-gray-500 text-sm border-t border-[rgba(128,0,32,0.1)]">
          <p>© 2025 Aggie AI - Help Texas A&M Students Find the Right Classes</p>
        </footer>
      )}
    </div>
  );
}