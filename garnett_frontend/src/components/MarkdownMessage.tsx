"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-3 mb-2 text-gray-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold mt-3 mb-1.5 text-gray-900 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed text-gray-800">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 space-y-1 text-gray-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 space-y-1 text-gray-800">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[#800020] underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-4 border-gray-200" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[rgba(128,0,32,0.25)] pl-3 my-2 text-gray-700 italic">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    if (!className) {
      return (
        <code
          className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] font-mono text-gray-800"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`font-mono text-sm ${className}`} {...props}>
        {children}
      </code>
    );
  },
};

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
