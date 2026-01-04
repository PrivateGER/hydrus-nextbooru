"use client";

import { useState, useEffect, useRef } from "react";

export interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setShow(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShow(false);
  };

  return (
    <div className="relative inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 shadow-lg">
            {content}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
          </div>
        </div>
      )}
    </div>
  );
}
