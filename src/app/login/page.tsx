"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "./actions";

/**
 * Validate that a return path is safe (no open redirect)
 */
function isValidReturnPath(path: string): boolean {
  // Only allow relative paths starting with /
  if (!path.startsWith("/")) return false;
  // Prevent protocol-relative URLs (//evil.com)
  if (path.startsWith("//")) return false;
  // Prevent URLs with protocols (javascript:, data:, etc)
  if (path.includes(":")) return false;
  return true;
}

/**
 * Loading fallback for the login form
 */
function LoginFormSkeleton() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <div className="mb-2 h-7 w-32 animate-pulse rounded bg-zinc-800" />
          <div className="mb-6 h-5 w-48 animate-pulse rounded bg-zinc-800" />
          <div className="space-y-4">
            <div>
              <div className="mb-1 h-4 w-20 animate-pulse rounded bg-zinc-800" />
              <div className="h-10 w-full animate-pulse rounded bg-zinc-800" />
            </div>
            <div className="h-10 w-full animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Login form that uses useSearchParams (must be wrapped in Suspense)
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawReturnTo = searchParams.get("returnTo") || "/admin";
  const returnTo = isValidReturnPath(rawReturnTo) ? rawReturnTo : "/admin";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(password);

      if (result.success) {
        router.push(returnTo);
        router.refresh();
      } else {
        setError(result.error || "Invalid password");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <h1 className="mb-2 text-xl font-semibold text-zinc-100">
            Admin Login
          </h1>
          <p className="mb-6 text-sm text-zinc-400">
            Enter the admin password to access admin features.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter password"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-900/50 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin login page.
 *
 * Authenticates with ADMIN_PASSWORD env var.
 * Redirects to the returnTo URL after successful login.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
