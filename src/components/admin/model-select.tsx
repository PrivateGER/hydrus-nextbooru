"use client";

import { useState, useEffect, useRef } from "react";
import { BanknotesIcon, ChevronDownIcon, EyeIcon } from "@heroicons/react/24/outline";
import type { ModelDefinition } from "@/lib/openrouter/types";

export interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  models: ModelDefinition[];
  allowCustom?: boolean;
}

export function ModelSelect({ value, onChange, models, allowCustom = false }: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === value);
  const isCustom = allowCustom && value === "custom";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const renderTags = (model: ModelDefinition) => (
    <span className="ml-auto flex items-center gap-1.5">
      {model.vision && (
        <span className="flex items-center gap-0.5 rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
          <EyeIcon className="h-3 w-3" />
          Vision
        </span>
      )}
      {model.expensive && (
        <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
          <BanknotesIcon className="h-3 w-3" />
          $$$
        </span>
      )}
    </span>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-left text-sm outline-none transition-colors hover:border-zinc-600 focus:border-zinc-500"
      >
        <span className="flex items-center gap-2 overflow-hidden">
          {isCustom ? (
            <span className="text-zinc-400">Custom model</span>
          ) : selectedModel ? (
            <>
              <span className="truncate">{selectedModel.name}</span>
              {renderTags(selectedModel)}
            </>
          ) : (
            <span className="text-zinc-400">Select a model...</span>
          )}
        </span>
        <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-64 overflow-y-auto">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-700/50 ${
                  value === m.id ? "bg-zinc-700/30 text-white" : "text-zinc-300"
                }`}
              >
                <span className="truncate">{m.name}</span>
                {renderTags(m)}
              </button>
            ))}
            {allowCustom && (
              <button
                type="button"
                onClick={() => {
                  onChange("custom");
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 border-t border-zinc-700 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-700/50 ${
                  isCustom ? "bg-zinc-700/30 text-white" : "text-zinc-400"
                }`}
              >
                Custom...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
