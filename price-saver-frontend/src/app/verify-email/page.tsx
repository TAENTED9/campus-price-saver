"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader, MailCheck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type State = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const params   = useSearchParams();
  const router   = useRouter();
  const token    = params.get("token");

  const [state,    setState]    = useState<State>("loading");
  const [message,  setMessage]  = useState("");
  const [email,    setEmail]    = useState("");
  const [resent,   setResent]   = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token found in the URL.");
      return;
    }

    fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Verification failed.");
        }
        setEmail(data.email || "");
        setState("success");
        // Redirect after 2.5 s
        setTimeout(() => {
          router.push(
            `/signin?verified=true${data.email ? `&email=${encodeURIComponent(data.email)}` : ""}`
          );
        }, 2500);
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, [token, router]);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      // silent — server always returns success-like response
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        {/* Campify wordmark */}
        <p className="text-xl font-bold text-brand-600 dark:text-brand-400 mb-8 tracking-tight">
          Campify
        </p>

        {state === "loading" && (
          <>
            <Loader size={48} className="mx-auto mb-4 text-brand-500 animate-spin" />
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Verifying your email…
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Just a moment.</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle size={56} className="mx-auto mb-4 text-green-500" />
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Email verified!
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Redirecting you to sign in…
            </p>
            <Link
              href={`/signin?verified=true${email ? `&email=${encodeURIComponent(email)}` : ""}`}
              className="inline-block px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-full transition-colors"
            >
              Go to Sign In
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle size={56} className="mx-auto mb-4 text-red-500" />
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Verification failed
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>

            {!resent ? (
              <button
                onClick={handleResend}
                disabled={resending || !email}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <MailCheck size={16} />
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                A new link was sent — check your inbox.
              </p>
            )}

            <p className="mt-5 text-sm text-gray-400">
              Already verified?{" "}
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
