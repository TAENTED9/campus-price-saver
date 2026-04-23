"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle, XCircle, Loader } from "lucide-react";
import { authApi } from "@/lib/api";

type State = "idle" | "loading" | "success" | "invalid";

export default function ResetPasswordPage() {
  const params   = useSearchParams();
  const router   = useRouter();
  const token    = params.get("token") || "";
  const email    = params.get("email") || "";

  const [state,      setState]      = useState<State>(token ? "idle" : "invalid");
  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState("");

  // Strip token from browser URL so it won't appear in referrer headers
  useEffect(() => {
    if (token && typeof window !== "undefined") {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("token");
      window.history.replaceState({}, "", clean.toString());
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setState("loading");
    try {
      await authApi.resetPassword(token, email, password);
      setState("success");
      setTimeout(() => router.push("/signin"), 3000);
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Reset failed. The link may have expired.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <p className="text-xl font-bold text-brand-600 dark:text-brand-400 mb-8 tracking-tight text-center">
          Campify
        </p>

        {state === "success" && (
          <div className="text-center">
            <CheckCircle size={56} className="mx-auto mb-4 text-green-500" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Password updated!
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Redirecting you to sign in…
            </p>
            <Link
              href="/signin"
              className="inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-full transition-colors"
            >
              Sign in now
            </Link>
          </div>
        )}

        {state === "invalid" && (
          <div className="text-center">
            <XCircle size={56} className="mx-auto mb-4 text-red-500" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Invalid link
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This password reset link is missing or malformed.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-full transition-colors"
            >
              Request a new link
            </Link>
          </div>
        )}

        {(state === "idle" || state === "loading") && (
          <>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-1">
              Set a new password
            </h1>
            {email && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                For <span className="font-medium">{email}</span>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
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
                  <><Loader size={15} className="animate-spin" /> Updating…</>
                ) : (
                  "Update password"
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-400">
              Link expired?{" "}
              <Link href="/forgot-password" className="text-brand-500 hover:text-brand-600 font-medium">
                Request a new one
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
