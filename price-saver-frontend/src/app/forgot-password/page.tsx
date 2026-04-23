"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle, Loader } from "lucide-react";
import { authApi } from "@/lib/api";

type State = "idle" | "loading" | "sent";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [state,   setState]   = useState<State>("idle");
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setError("");
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        {/* Wordmark */}
        <p className="text-xl font-bold text-brand-600 dark:text-brand-400 mb-8 tracking-tight text-center">
          Campify
        </p>

        {state === "sent" ? (
          <div className="text-center">
            <CheckCircle size={56} className="mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Check your email
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              If <span className="font-medium">{email}</span> is registered and
              verified, we&apos;ve sent a password reset link. It expires in&nbsp;1&nbsp;hour.
            </p>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">
              Forgot your password?
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={state === "loading"}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state === "loading" ? (
                  <><Loader size={15} className="animate-spin" /> Sending…</>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-500">
              Remembered it?{" "}
              <Link href="/signin" className="text-brand-500 hover:text-brand-600 font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
