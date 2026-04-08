"use client";
import { useState, useRef, useEffect } from 'react';
import { Inter, Nunito } from 'next/font/google';
import Navbar from "@/components/Navbar";
import CourseLinkCard from "@/components/CourseLinkCard";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import CourseSelector from "@/components/CourseSelector";
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

const TOOL_DISPLAY_LABELS: Record<string, string> = {
  prefetch_course_data: "Fetch course data",
  resolve_courses: "Resolve courses",
  get_course_gpa_summary: "Course GPA summary",
  rank_instructors_in_course_by_gpa: "Rank profs in course",
  get_full_course_breakdown: "Course breakdown",
  search_professors_by_name: "Search professors",
  get_instructor_rows_in_course: "Instructor sections",
  list_course_tables: "List courses",
  rank_courses_by_avg_gpa: "Rank by GPA",
  compare_courses_by_overall_gpa: "Compare course GPAs",
  find_courses_for_instructor: "Find courses (instructor)",
  get_ratemyprofessor_links: "RMP links",
  fetch_rmp_profiles: "RateMyProfessor",
};

function formatToolCallLabel(toolName: string): string {
  return TOOL_DISPLAY_LABELS[toolName] ?? toolName.replace(/_/g, " ");
}

function uniqueToolCallsInOrder(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

type ToolStepStatus = "running" | "done" | "error";

type ToolStep = {
  id: string;
  toolName: string;
  status: ToolStepStatus;
};

function ToolSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 animate-spin ${className ?? "h-3.5 w-3.5"}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
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
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ToolCallTags({ toolNames }: { toolNames: string[] }) {
  const unique = uniqueToolCallsInOrder(toolNames);
  if (unique.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 mb-2"
      aria-label="Tools used"
    >
      <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mr-0.5">
        Tools
      </span>
      {unique.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[rgba(128,0,32,0.06)] text-[#800020] border border-[rgba(128,0,32,0.12)]"
        >
          <svg
            className="h-3 w-3 text-emerald-600 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {formatToolCallLabel(name)}
        </span>
      ))}
    </div>
  );
}

function StreamingToolSteps({ steps }: { steps: ToolStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 mb-2"
      role="status"
      aria-live="polite"
      aria-label="Tool progress"
    >
      <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mr-0.5">
        Tools
      </span>
      {steps.map((step) => {
        const isRunning = step.status === "running";
        const isError = step.status === "error";
        return (
          <span
            key={step.id}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
              isError
                ? "bg-red-50 text-red-800 border-red-200"
                : isRunning
                  ? "bg-[rgba(128,0,32,0.06)] text-[#800020] border-[rgba(128,0,32,0.2)]"
                  : "bg-emerald-50/80 text-emerald-900 border-emerald-200/80"
            }`}
          >
            {isRunning && (
              <ToolSpinner className="h-3.5 w-3.5 text-[#800020]" />
            )}
            {step.status === "done" && (
              <svg
                className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isError && (
              <svg
                className="h-3.5 w-3.5 text-red-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>
              {formatToolCallLabel(step.toolName)}
              {isRunning && (
                <span className="sr-only"> — running</span>
              )}
              {step.status === "done" && (
                <span className="sr-only"> — finished</span>
              )}
              {isError && (
                <span className="sr-only"> — failed</span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// Message type definition
type Message = {
  content: string;
  isUser: boolean;
  id?: string;
  hasCourseLink?: boolean;
  courseCode?: string;
  courseCodes?: string[]; // For multiple courses
  toolCalls?: string[];
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
  const [streamingToolSteps, setStreamingToolSteps] = useState<ToolStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedProfessorsByCourse, setSelectedProfessorsByCourse] = useState<Record<string, string[]>>({});
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
    setSessionContext({ currentCourse: null, activeCourses: [] });
    setSelectedCourses([]);
    setSelectedProfessorsByCourse({});

    localStorage.removeItem('chatMessages');
    localStorage.removeItem('sessionContext');
    localStorage.removeItem('conversationStarted');
    localStorage.removeItem('selectedCourses');
    localStorage.removeItem('selectedProfessorsByCourse');

    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    const savedContext = localStorage.getItem('sessionContext');
    const savedConversationState = localStorage.getItem('conversationStarted');
    const savedCourses = localStorage.getItem('selectedCourses');
    const savedProfs = localStorage.getItem('selectedProfessorsByCourse');

    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedContext) setSessionContext(JSON.parse(savedContext));
    if (savedConversationState === 'true') setConversationStarted(true);
    if (savedCourses) setSelectedCourses(JSON.parse(savedCourses));
    if (savedProfs) setSelectedProfessorsByCourse(JSON.parse(savedProfs));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
      localStorage.setItem('conversationStarted', String(conversationStarted));
    }
    if (sessionContext.activeCourses && sessionContext.activeCourses.length > 0) {
      localStorage.setItem('sessionContext', JSON.stringify(sessionContext));
    }
  }, [messages, sessionContext, conversationStarted]);

  useEffect(() => {
    localStorage.setItem('selectedCourses', JSON.stringify(selectedCourses));
    localStorage.setItem('selectedProfessorsByCourse', JSON.stringify(selectedProfessorsByCourse));
  }, [selectedCourses, selectedProfessorsByCourse]);

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

  const canSend = selectedCourses.length > 0 && inputValue.trim().length > 0 && !isLoading && !isStreaming;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || selectedCourses.length === 0) return;

    const userMessage = inputValue;

    if (!conversationStarted) {
      setConversationStarted(true);
    }

    setMessages(prev => [...prev, { content: userMessage, isUser: true }]);
    setInputValue('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingResponse('');
    setStreamingToolSteps([]);

    try {
      const controller = new AbortController();
      setAbortController(controller);

      const conversationHistory = messages.slice(-10);

      const response = await fetch('/api/answer_with_rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          conversationHistory,
          sessionContext,
          selectedCourses,
          selectedProfessorsByCourse,
          useStreaming: true,
        }),
        signal: controller.signal,
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
      const accumulatedToolCalls: string[] = [];
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

                case 'tool_call_start':
                  if (
                    typeof data.toolCallId === 'string' &&
                    typeof data.toolName === 'string'
                  ) {
                    accumulatedToolCalls.push(data.toolName);
                    setStreamingToolSteps((prev) => [
                      ...prev,
                      {
                        id: data.toolCallId,
                        toolName: data.toolName,
                        status: 'running',
                      },
                    ]);
                  }
                  break;

                case 'tool_call_done':
                  if (typeof data.toolCallId === 'string') {
                    const failed = Boolean(data.error);
                    setStreamingToolSteps((prev) =>
                      prev.map((step) =>
                        step.id === data.toolCallId
                          ? { ...step, status: failed ? 'error' : 'done' }
                          : step
                      )
                    );
                  }
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
                  {
                    const toolCallsFromServer = Array.isArray(data.toolCalls)
                      ? (data.toolCalls as string[])
                      : [];
                    const toolCalls =
                      toolCallsFromServer.length > 0
                        ? toolCallsFromServer
                        : [...accumulatedToolCalls];
                  // Add final complete message to chat
                  setMessages(prev => [...prev, {
                    content: data.answer,
                    isUser: false,
                    id: Date.now().toString(),
                    hasCourseLink: data.sessionContext?.activeCourses?.length > 0,
                    courseCode: data.sessionContext?.activeCourses?.[0],
                    courseCodes: data.sessionContext?.activeCourses || [],
                    toolCalls,
                  }]);
                  }

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
      setStreamingToolSteps([]);
      setAbortController(null);
    }
  };

  // Sample prompts with icons
  const samplePrompts = [
    {
      text: "Who is the easiest professor?",
      icon: "👨‍🏫"
    },
    {
      text: "Compare these professors by GPA and reviews",
      icon: "📊"
    },
    {
      text: "Which professor gives the best grades?",
      icon: "📚"
    }
  ];

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleSamplePromptClick = (prompt: string) => {
    setInputValue(prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-white ${inter.className} font-medium`}>
      <Navbar onNewChat={handleNewChat} conversationStarted={conversationStarted} />

      <main className={`flex-1 min-h-0 flex flex-col items-center ${conversationStarted ? 'w-full p-0 mt-10' : 'px-4 py-6 overflow-y-auto'}`}>


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
            ? 'flex-1 min-h-0 border-none'
            : 'max-w-3xl rounded-2xl overflow-hidden card-modern'
            }`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={conversationStarted ? undefined : { minHeight: '300px' }}
        >
          {/* Chat messages */}
          <div
            ref={chatContainerRef}
            className={`overflow-y-auto ${conversationStarted ? 'flex-1 min-h-0 w-full mx-auto' : 'flex-grow p-4'}`}
            style={conversationStarted ? undefined : { maxHeight: 'calc(100vh - 350px)', minHeight: '250px' }}
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
                      <div className="max-w-[1000px]">
                        {!message.isUser &&
                          message.toolCalls &&
                          message.toolCalls.length > 0 && (
                            <ToolCallTags toolNames={message.toolCalls} />
                          )}
                        <div
                          className={`p-3 rounded-xl inline-block max-w-[1000px] text-lg ${message.isUser
                            ? 'bg-gray-50 text-gray-800'
                            : 'bg-white text-gray-800 rounded-tl-none'
                            }`}
                        >
                          {message.isUser ? (
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                          ) : (
                            <MarkdownMessage content={message.content} className="text-lg" />
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Show course link cards for AI responses when courses are detected */}
                    {!message.isUser && message.hasCourseLink && message.courseCodes && message.courseCodes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
                        {message.courseCodes.map((courseCode, courseIndex) => (
                          <CourseLinkCard 
                            key={`${message.id}-course-${courseIndex}`}
                            courseCode={courseCode} 
                            isVisible={true} 
                          />
                        ))}
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
                    {streamingToolSteps.length > 0 && (
                      <StreamingToolSteps steps={streamingToolSteps} />
                    )}
                    {/* Streaming text */}
                    {streamingResponse ? (
                      <div className="relative">
                        <MarkdownMessage content={streamingResponse} className="text-lg" />
                        <span className="inline-block w-0.5 h-5 align-middle bg-gray-800 animate-pulse ml-0.5" />
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
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-3 px-3">
                    {sessionContext.activeCourses.map((courseCode, courseIndex) => (
                      <CourseLinkCard 
                        key={`streaming-course-${courseIndex}`}
                        courseCode={courseCode} 
                        isVisible={true} 
                      />
                    ))}
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
          <div className={`shrink-0 border-t ${conversationStarted ? 'border-gray-200' : 'border-[rgba(128,0,32,0.1)]'} p-4 glass`}>
            <div className={`${conversationStarted ? 'max-w-7xl mx-auto w-full' : ''} mb-2`}>
              <CourseSelector
                selectedCourses={selectedCourses}
                selectedProfessorsByCourse={selectedProfessorsByCourse}
                onCoursesChange={setSelectedCourses}
                onProfessorsChange={setSelectedProfessorsByCourse}
              />
            </div>
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
                  selectedCourses.length === 0
                    ? "Select at least one course above to start..."
                    : selectedCourses.length === 1
                    ? `Ask about ${selectedCourses[0]}...`
                    : `Ask about ${selectedCourses[0]} and ${selectedCourses.length - 1} other course${selectedCourses.length > 2 ? 's' : ''}...`
                }
                className={`w-full py-4 px-5 pr-16 rounded-xl border text-lg ${isTyping ? 'border-[#800020] ring-2 ring-[rgba(128,0,32,0.1)]' : 'border-[rgba(128,0,32,0.1)]'} outline-none resize-y overflow-y-auto transition-all ${selectedCourses.length === 0 ? 'bg-gray-50 cursor-not-allowed' : 'input-modern'}`}
                style={{ minHeight: '60px', maxHeight: '200px' }}
                rows={1}
                disabled={selectedCourses.length === 0}
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
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 w-10 h-10 flex items-center justify-center ${canSend ? 'maroon-gradient text-white' : 'bg-[rgba(128,0,32,0.1)] text-[#800020]'
                    } transition-all`}
                  disabled={!canSend}
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