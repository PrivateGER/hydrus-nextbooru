"use client";

import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

interface MarkdownProps {
  content: string;
  className?: string;
}

// Configure marked for safe rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

/**
 * Renders markdown content as HTML.
 *
 * @param content - The markdown string to render
 * @param className - Optional CSS class names to apply to the container
 */
export function Markdown({ content, className = "" }: MarkdownProps) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  return (
    <div
      className={`prose prose-sm prose-zinc dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
