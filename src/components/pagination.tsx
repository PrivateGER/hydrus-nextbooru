"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const delta = 2; // Number of pages to show on each side of current

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push("...");
    }

    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      pages.push("...");
    }

    // Always show last page (if more than 1 page)
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers();

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      {/* Previous button */}
      {currentPage > 1 ? (
        <Link
          href={buildPageUrl(currentPage - 1)}
          className="rounded px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Previous
        </Link>
      ) : (
        <span className="rounded px-3 py-2 text-sm font-medium text-zinc-600">
          Previous
        </span>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} className="px-2 text-zinc-500">
              ...
            </span>
          ) : (
            <Link
              key={page}
              href={buildPageUrl(page)}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                page === currentPage
                  ? "bg-blue-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {page}
            </Link>
          )
        )}
      </div>

      {/* Next button */}
      {currentPage < totalPages ? (
        <Link
          href={buildPageUrl(currentPage + 1)}
          className="rounded px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Next
        </Link>
      ) : (
        <span className="rounded px-3 py-2 text-sm font-medium text-zinc-600">
          Next
        </span>
      )}
    </nav>
  );
}
