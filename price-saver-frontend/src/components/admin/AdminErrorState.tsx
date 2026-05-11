"use client";

import React from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

type AdminErrorStateProps = {
  message?: string | null;
  onRetry?: () => void;
  variant?: "inline" | "page";
};

const NETWORK_KEYWORDS = ["network", "fetch", "timeout", "connection", "timed out"];

function isNetworkError(msg?: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return NETWORK_KEYWORDS.some((k) => lower.includes(k));
}

export default function AdminErrorState({
  message,
  onRetry,
  variant = "inline",
}: AdminErrorStateProps) {
  const isNetwork = isNetworkError(message);
  const Icon = isNetwork ? WifiOff : AlertTriangle;
  const title = isNetwork ? "Connection problem" : "Something went wrong";
  const detail = message ?? "An unexpected error occurred. Please try again.";

  if (variant === "page") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20">
          <Icon className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</p>
          <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">{detail}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">{title}</p>
        <p className="text-xs text-red-600 dark:text-red-400 truncate">{detail}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-300 transition-colors"
        >
          <RefreshCw size={11} />
          Retry
        </button>
      )}
    </div>
  );
}
