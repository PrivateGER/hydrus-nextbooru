"use client";

import { useState } from "react";

interface Note {
  id: number;
  name: string;
  content: string;
  translatedContent: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  translatedAt: Date | null;
}

interface NoteCardProps {
  note: Note;
}

export function NoteCard({ note: initialNote }: NoteCardProps) {
  const [note, setNote] = useState(initialNote);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${note.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Translation failed");
      }

      const updatedNote = await response.json();
      setNote({
        ...note,
        translatedContent: updatedNote.translatedContent,
        sourceLanguage: updatedNote.sourceLanguage,
        targetLanguage: updatedNote.targetLanguage,
        translatedAt: updatedNote.translatedAt ? new Date(updatedNote.translatedAt) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const hasTranslation = note.translatedContent !== null;
  const displayContent =
    hasTranslation && !showOriginal ? note.translatedContent : note.content;

  return (
    <div className="rounded bg-zinc-700/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-300">{note.name}</h3>
        <div className="flex items-center gap-2">
          {hasTranslation && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showOriginal ? "Show translation" : "Show original"}
            </button>
          )}

          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={hasTranslation ? "Re-translate" : "Translate"}
          >
            {isTranslating ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Translating...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802"
                  />
                </svg>
                {hasTranslation ? "Re-translate" : "Translate"}
              </>
            )}
          </button>
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <p className="whitespace-pre-wrap text-sm">{displayContent}</p>

      {hasTranslation && !showOriginal && note.sourceLanguage && note.targetLanguage && (
        <p className="mt-2 text-xs text-zinc-500">
          Translated from {note.sourceLanguage.toUpperCase()} to{" "}
          {note.targetLanguage.toUpperCase()}
        </p>
      )}
    </div>
  );
}
