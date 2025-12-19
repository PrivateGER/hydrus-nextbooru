import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { SiteLockGuard } from "@/components/site-lock-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Booru",
  description: "Image board powered by Hydrus",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-900 text-zinc-100 antialiased`}
      >
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link href="/" className="text-xl font-bold text-blue-400">
              NextBooru
            </Link>

            <MobileNav />

            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/"
                className="text-sm font-medium text-zinc-300 hover:text-white"
              >
                Gallery
              </Link>
              <Link
                href="/search"
                className="text-sm font-medium text-zinc-300 hover:text-white"
              >
                Search
              </Link>
              <Link
                href="/tags"
                className="text-sm font-medium text-zinc-300 hover:text-white"
              >
                Tags
              </Link>
              <Link
                href="/tree"
                className="text-sm font-medium text-zinc-300 hover:text-white"
              >
                Tree
              </Link>
              <Link
                href="/groups"
                className="text-sm font-medium text-zinc-300 hover:text-white"
              >
                Groups
              </Link>
              <Link
                href="/admin/sync"
                className="text-sm font-medium text-zinc-300 hover:text-white"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-7xl px-4 py-6">
          <SiteLockGuard>{children}</SiteLockGuard>
        </main>
      </body>
    </html>
  );
}
