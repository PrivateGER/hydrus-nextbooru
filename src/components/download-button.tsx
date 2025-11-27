"use client";

interface DownloadButtonProps {
  hash: string;
  extension: string;
  filename: string;
  className?: string;
  showTextOnLg?: boolean;
}

export function DownloadButton({
  hash,
  extension,
  filename,
  className = "",
  showTextOnLg = false,
}: DownloadButtonProps) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `/api/download/${hash}${extension}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleDownload}
      className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 ${className}`}
      title={`Download ${filename}`}
    >
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
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      {showTextOnLg ? (
        <span className="hidden lg:inline">Download</span>
      ) : (
        <span>Download</span>
      )}
    </button>
  );
}
