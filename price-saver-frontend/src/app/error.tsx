"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Log to an error reporting service if connected
    console.error("[Campify] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={28} className="text-red-500" />
        </div>

        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
          An unexpected error occurred. Our team has been notified. You can try
          refreshing the page or go back home.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-xl hover:bg-brand-600 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            Back to home
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
