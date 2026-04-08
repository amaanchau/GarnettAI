"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 text-black first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-3 mb-2 text-black first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold mt-3 mb-1.5 text-black first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed text-black">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 space-y-1 text-black">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 space-y-1 text-black">{children}</ol>
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
    <strong className="font-semibold text-black">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-4 border-[#C5C5C5]" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#800020]/25 pl-3 my-2 text-[#444] italic">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-[#f5f5f5] p-3 text-sm text-black">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    if (!className) {
      return (
        <code
          className="rounded bg-[#f5f5f5] px-1 py-0.5 text-[0.9em] font-mono text-black"
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
