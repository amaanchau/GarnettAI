"use client";
import { useState, useRef, useEffect } from 'react';
import { Inter, Cormorant_Garamond, Nunito } from 'next/font/google';
import Navbar from "@/components/Navbar";
import CourseLinkCard, { ProfessorLinkCard } from "@/components/CourseLinkCard";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import CourseSelector from "@/components/CourseSelector";
import { motion, AnimatePresence } from 'framer-motion';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

const heading = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ToolCallTags({ toolNames }: { toolNames: string[] }) {
  const unique = uniqueToolCallsInOrder(toolNames);
  if (unique.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2" aria-label="Tools used">
      <span className="text-[11px] uppercase tracking-wider text-[#888] font-semibold mr-0.5">
        Tools
      </span>
      {unique.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#f7f5f3] text-[#800020] border border-[#C5C5C5]"
        >
          <svg className="h-3 w-3 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
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
    <div className="flex flex-wrap items-center gap-1.5 mb-2" role="status" aria-live="polite" aria-label="Tool progress">
      <span className="text-[11px] uppercase tracking-wider text-[#888] font-semibold mr-0.5">
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
                ? "bg-red-50 text-red-700 border-red-200"
                : isRunning
                  ? "bg-[#f7f5f3] text-[#800020] border-[#800020]/20"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {isRunning && <ToolSpinner className="h-3.5 w-3.5 text-[#800020]" />}
            {step.status === "done" && (
              <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isError && (
              <svg className="h-3.5 w-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>
              {formatToolCallLabel(step.toolName)}
              {isRunning && <span className="sr-only"> — running</span>}
              {step.status === "done" && <span className="sr-only"> — finished</span>}
              {isError && <span className="sr-only"> — failed</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}

type ProfessorLink = {
  name: string;
};

type WebSource = {
  title?: string;
  url?: string;
};

type Message = {
  content: string;
  isUser: boolean;
  id?: string;
  hasCourseLink?: boolean;
  courseCode?: string;
  courseCodes?: string[];
  professorLinks?: ProfessorLink[];
  webSources?: WebSource[];
  toolCalls?: string[];
};

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
  const [submitError, setSubmitError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleStopRequest = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsStreaming(false);
    setIsLoading(false);
    setStreamingResponse('');
  };

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
    if (selectedCourses.length > 0 && submitError) setSubmitError('');
  }, [selectedCourses, selectedProfessorsByCourse, submitError]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, streamingResponse]);

  const canSend = inputValue.trim().length > 0 && !isLoading && !isStreaming;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    if (selectedCourses.length === 0) {
      setSubmitError('Please select at least one course first');
      setTimeout(() => setSubmitError(''), 3000);
      return;
    }

    const userMessage = inputValue;

    if (!conversationStarted) {
      setConversationStarted(true);
    }

    const profNames = [...new Set(Object.values(selectedProfessorsByCourse).flat())];
    const profLinksForMessage: ProfessorLink[] = profNames.map(name => ({ name }));

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
                  await new Promise(resolve => setTimeout(resolve, 55));
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
                    const webSources = Array.isArray(data.webSources)
                      ? (data.webSources as WebSource[]).filter((s) => s.url)
                      : [];
                    setMessages(prev => [...prev, {
                      content: data.answer,
                      isUser: false,
                      id: Date.now().toString(),
                      hasCourseLink: data.sessionContext?.activeCourses?.length > 0,
                      courseCode: data.sessionContext?.activeCourses?.[0],
                      courseCodes: data.sessionContext?.activeCourses || [],
                      professorLinks: profLinksForMessage.length > 0 ? profLinksForMessage : undefined,
                      webSources: webSources.length > 0 ? webSources : undefined,
                      toolCalls,
                    }]);
                  }

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

      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user');
      } else {
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

  const samplePrompts = [
    { text: "What do students say about this course online?", icon: "🌐" },
    { text: "Who should I take for this class and why?", icon: "🔍" },
    { text: "Break down the grade distributions and professor ratings", icon: "📊" }
  ];

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
    <div className={`flex flex-col h-screen overflow-hidden bg-[#f7f5f3] ${inter.className}`}>
      <Navbar onNewChat={handleNewChat} conversationStarted={conversationStarted} />

      <main className={`flex-1 min-h-0 flex flex-col items-center ${conversationStarted ? 'w-full p-0 mt-0' : 'px-4 py-8 overflow-y-auto'}`}>

        {!conversationStarted && (
          <>
            <motion.div
              className="text-center mb-8 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.h1
                className={`text-6xl font-bold text-[#800020] mb-4 tracking-tight ${heading.className}`}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                Aggie AI
              </motion.h1>
              <p className={`text-xl text-[#444] max-w-2xl mx-auto leading-relaxed ${nunito.className}`}>
                Ask anything about Texas A&M courses & professors. Get insights on grading, difficulty, and professor ratings.
              </p>
            </motion.div>

            <motion.div
              className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-3 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {samplePrompts.map((prompt, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-white border border-[#C5C5C5] rounded-xl p-5 cursor-pointer flex flex-col hover:shadow-md transition-shadow"
                  onClick={() => handleSamplePromptClick(prompt.text)}
                >
                  <span className="text-2xl mb-2">{prompt.icon}</span>
                  <span className="text-sm text-black leading-snug">{prompt.text}</span>
                  <div className="mt-auto pt-3">
                    <div className="h-0.5 w-12 bg-[#800020] rounded-full opacity-40"></div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        <motion.div
          className={`w-full flex flex-col ${conversationStarted
            ? 'flex-1 min-h-0 border-none'
            : 'max-w-3xl rounded-xl overflow-hidden bg-white border border-[#C5C5C5] shadow-sm'
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
            style={conversationStarted ? undefined : { maxHeight: 'calc(100vh - 400px)', minHeight: '250px' }}
          >
            {messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-center text-[#888]">
                  <svg className="w-10 h-10 mx-auto mb-3 text-[#800020] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                  <p className="font-medium text-black">Start a conversation</p>
                  <p className="text-sm mt-1">Try one of the prompts above or type your own question.</p>
                  <p className="text-xs text-[#888] mt-2">Make sure to select at least one course above to get started.</p>
                </div>
              </div>
            ) : (
              <div className={conversationStarted ? "w-full max-w-4xl mx-auto px-4 py-2" : ""}>
                {messages.map((message, index) => (
                  <div key={index}>
                    <div className={`mb-4 flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[800px]">
                        {!message.isUser && message.toolCalls && message.toolCalls.length > 0 && (
                          <ToolCallTags toolNames={message.toolCalls} />
                        )}
                        <div
                          className={`px-4 py-3 rounded-2xl inline-block max-w-[800px] ${message.isUser
                            ? 'bg-[#373230] text-white border border-[#404040] rounded-br-md'
                            : 'bg-[#e8e5e2] text-black border border-[#b0b0b0] rounded-bl-md'
                            }`}
                        >
                          {message.isUser ? (
                            <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{message.content}</p>
                          ) : (
                            <MarkdownMessage content={message.content} className="text-[15px]" />
                          )}
                        </div>
                      </div>
                    </div>
                    {!message.isUser && ((message.hasCourseLink && message.courseCodes && message.courseCodes.length > 0) || (message.professorLinks && message.professorLinks.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
                        {message.courseCodes?.map((courseCode, courseIndex) => (
                          <CourseLinkCard
                            key={`${message.id}-course-${courseIndex}`}
                            courseCode={courseCode}
                            isVisible={true}
                          />
                        ))}
                        {message.professorLinks?.map((prof, profIndex) => (
                          <ProfessorLinkCard
                            key={`${message.id}-prof-${profIndex}`}
                            professorName={prof.name}
                            isVisible={true}
                          />
                        ))}
                      </div>
                    )}
                    {!message.isUser && message.webSources && message.webSources.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="flex flex-wrap items-center gap-1.5 mt-1 mb-3"
                      >
                        <span className="text-[11px] uppercase tracking-wider text-[#888] font-semibold mr-0.5">Sources</span>
                        {message.webSources.map((source, srcIdx) => {
                          let favicon = '';
                          let hostname = '';
                          try {
                            hostname = new URL(source.url || '').hostname.replace('www.', '');
                            favicon = `https://www.google.com/s2/favicons?sz=16&domain=${hostname}`;
                          } catch { /* skip */ }
                          return (
                            <motion.a
                              key={`${message.id}-src-${srcIdx}`}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25, delay: srcIdx * 0.06 }}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={source.title || hostname}
                              className="inline-flex items-center gap-1 text-[11px] text-[#666] hover:text-black bg-white hover:bg-[#f7f5f3] px-1.5 py-0.5 rounded-full border border-[#C5C5C5]/60 transition-colors"
                            >
                              {favicon && (
                                <img src={favicon} alt="" className="h-3 w-3 shrink-0 rounded-sm" />
                              )}
                              {hostname.split('.').slice(-2).join('.')}
                            </motion.a>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Streaming response */}
            {isStreaming && (
              <div className={conversationStarted ? "w-full max-w-4xl mx-auto px-4" : ""}>
                <div className="flex mb-4 justify-start w-full">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[#e8e5e2] text-black border border-[#b0b0b0] max-w-[800px]">
                    {streamingToolSteps.length > 0 && (
                      <StreamingToolSteps steps={streamingToolSteps} />
                    )}
                    {streamingResponse ? (
                      <div className="relative inline">
                        <MarkdownMessage content={streamingResponse} className="text-[15px] inline" />
                        <span className="inline-block w-2 h-2 rounded-full bg-[#800020] animate-pulse align-middle ml-1" />
                      </div>
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-[#800020] animate-pulse" />
                    )}
                  </div>
                </div>
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

            {isLoading && !isStreaming && (
              <div className={conversationStarted ? "w-full max-w-4xl mx-auto px-4" : ""}>
                <div className="flex mb-4 justify-start w-full">
                  <div className="p-3 rounded-2xl rounded-bl-md flex items-center">
                    <div className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#800020] opacity-30"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-[#800020]"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className={`shrink-0 border-t border-[#C5C5C5]/40 bg-[#f7f5f3] p-4`}>
            <div className={`${conversationStarted ? 'max-w-4xl mx-auto w-full' : ''} mb-2`}>
              <CourseSelector
                selectedCourses={selectedCourses}
                selectedProfessorsByCourse={selectedProfessorsByCourse}
                onCoursesChange={setSelectedCourses}
                onProfessorsChange={setSelectedProfessorsByCourse}
              />
            </div>
            <form onSubmit={handleSubmit} className={`relative ${conversationStarted ? 'max-w-4xl mx-auto w-full' : ''}`}>
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
                    ? "Ask about any course or professor..."
                    : selectedCourses.length === 1
                    ? `Ask about ${selectedCourses[0]}...`
                    : `Ask about ${selectedCourses[0]} and ${selectedCourses.length - 1} other course${selectedCourses.length > 2 ? 's' : ''}...`
                }
                className={`w-full py-3 px-4 pr-14 rounded-xl border text-[15px] text-black placeholder:text-[#999] ${
                  submitError
                    ? 'border-red-400 ring-2 ring-red-100'
                    : isTyping
                      ? 'border-[#800020] ring-2 ring-[#800020]/10'
                      : 'border-[#C5C5C5]'
                } outline-none resize-y overflow-y-auto transition-all bg-white`}
                style={{ minHeight: '52px', maxHeight: '200px' }}
                rows={1}
              />

              {isStreaming && (
                <motion.button
                  type="button"
                  onClick={handleStopRequest}
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 w-9 h-9 flex items-center justify-center bg-[#800020] text-white hover:bg-[#600018] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              )}
              {!isStreaming && (
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 w-9 h-9 flex items-center justify-center transition-all ${
                    canSend
                      ? 'bg-[#800020] text-white hover:bg-[#600018]'
                      : 'bg-[#f2f2f2] text-[#C5C5C5]'
                  }`}
                  disabled={!canSend}
                >
                  {isLoading ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </motion.button>
              )}
            </form>
            <AnimatePresence>
              {submitError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`text-red-500 text-xs mt-1.5 ${conversationStarted ? 'max-w-4xl mx-auto w-full' : ''}`}
                >
                  {submitError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      {!conversationStarted && (
        <footer className="py-2 text-center text-[#888] text-xs border-t border-[#C5C5C5]/40">
          <p>&copy; 2025 Aggie AI &mdash; Texas A&M Course & Professor Insights</p>
        </footer>
      )}
    </div>
  );
}
