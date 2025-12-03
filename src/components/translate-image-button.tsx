"use client";

import { useState } from "react";
import { Markdown } from "./markdown";

interface TranslateImageButtonProps {
  hash: string;
  mimeType: string;
  existingTranslation?: {
    translatedText: string | null;
    sourceLanguage: string | null;
    targetLanguage: string | null;
  } | null;
}

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  hasText: boolean;
}

/**
 * Renders a button and UI for detecting and translating text contained in an image.
 *
 * @param hash - Identifier used to request translation for the corresponding post/image
 * @param mimeType - MIME type of the file; the component renders nothing if it does not start with "image/"
 * @param existingTranslation - Optional prefilled translation data (`translatedText`, `sourceLanguage`, `targetLanguage`); when provided the component initializes its displayed result from it
 * @returns The component's UI as a JSX element, or `null` when the MIME type is not an image.
 */
export function TranslateImageButton({ hash, mimeType, existingTranslation }: TranslateImageButtonProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(
    existingTranslation?.translatedText
      ? {
          translatedText: existingTranslation.translatedText,
          sourceLanguage: existingTranslation.sourceLanguage || "",
          targetLanguage: existingTranslation.targetLanguage || "",
          hasText: true,
        }
      : null
  );
  const [error, setError] = useState<string | null>(null);

  // Only show for images
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  const handleTranslate = async () => {
    setIsTranslating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/posts/${hash}/translate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Translation failed");
      }

      const data: TranslationResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="rounded-lg bg-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Image Text</h2>
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranslating ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
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
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Translate Image
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-3">
          {result.hasText ? (
            <>
              <p className="mb-2 text-xs text-zinc-500">
                Detected: {result.sourceLanguage.toUpperCase()} → {result.targetLanguage.toUpperCase()}
              </p>
              <div className="rounded bg-zinc-700/50 p-3">
                <Markdown content={result.translatedText} className="text-sm" />
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-400">No text found in this image.</p>
          )}
        </div>
      )}
    </div>
  );
}