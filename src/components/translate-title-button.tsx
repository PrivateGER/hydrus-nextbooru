"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TranslateTitleButtonProps {
  groupId: number;
  title: string;
  existingTranslation?: {
    translatedTitle: string | null;
    sourceLanguage: string | null;
    targetLanguage: string | null;
  } | null;
}

interface TranslationError {
  message: string;
  code?: string;
}

/**
 * Renders UI for translating a group title.
 * When a translation exists, shows the original title with language info.
 * When no translation exists, shows a translate button.
 *
 * @param groupId - The ID of the group to translate
 * @param title - The original title
 * @param existingTranslation - Optional prefilled translation data
 * @returns The component's UI as a JSX element
 */
export function TranslateTitleButton({
  groupId,
  title,
  existingTranslation,
}: TranslateTitleButtonProps) {
  const router = useRouter();
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<TranslationError | null>(null);

  const hasTranslation = !!existingTranslation?.translatedTitle;

  const handleTranslate = async () => {
    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        setError({
          message: data.error || "Translation failed",
          code: data.code,
        });
        return;
      }

      // Refresh the page to show the new translation in the title
      router.refresh();
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Translation failed",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="mt-1">
      {hasTranslation ? (
        // Show original title when translation exists (translated is shown in h1)
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="italic" title={title}>{title}</span>
          <span>({existingTranslation.sourceLanguage?.toUpperCase()})</span>
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="text-purple-400 hover:text-purple-300 disabled:opacity-50"
          >
            {isTranslating ? "..." : "Re-translate"}
          </button>
        </div>
      ) : (
        // Show translate button when no translation exists
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="inline-flex items-center gap-1.5 rounded-md bg-purple-600/20 px-2 py-1 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-600/30 disabled:cursor-not-allowed disabled:opacity-50"
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
              Translate
            </>
          )}
        </button>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-500/20 bg-red-500/10 p-2">
          <p className="text-xs text-red-400">{error.message}</p>
          {error.code === "MODEL_NO_VISION" && (
            <Link
              href="/admin"
              className="mt-1 inline-flex items-center gap-1 text-xs text-red-300 underline hover:text-red-200"
            >
              Go to Admin Settings →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
