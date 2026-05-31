"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/siteConfig";
import { Eye, EyeOff, CheckCircle, MailCheck, ShieldCheck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SignInForm() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { login, completeLogin } = useAuth();

  const [username,    setUsername]    = useState("");
  const [password,    setPassword]    = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,  setRememberMe]  = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  // FIX #8: structured error states. EMAIL_NOT_VERIFIED already existed;
  // ACCOUNT_PAUSED is new — backend returns it as a JSON detail object,
  // which the API client stringifies into err.message.
  const [errorType,   setErrorType]   = useState<
    "email_not_verified" | "account_paused" | "account_banned" | "account_suspended" | null
  >(null);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [banReason, setBanReason]   = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [suspendedUntil,  setSuspendedUntil]  = useState<string | null>(null);

  // verified=true banner
  const [verifiedBanner, setVerifiedBanner] = useState(false);

  // EMAIL_NOT_VERIFIED state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent,          setResent]          = useState(false);
  const [resending,       setResending]       = useState(false);

  // MFA two-step state — BUG-001
  const [mfaRequired,  setMfaRequired]  = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState<string | null>(null);
  const [mfaCode,      setMfaCode]      = useState("");
  const [mfaLoading,   setMfaLoading]   = useState(false);
  const [mfaError,     setMfaError]     = useState<string | null>(null);

  useEffect(() => {
    const v = params.get("verified");
    const u = params.get("username");
    if (v === "true") {
      setVerifiedBanner(true);
      if (u) setUsername(u);   // pre-fill username so user just types password
    }
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);

    if (!username.trim()) {
      setError("Please enter your email or username.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setErrorType(null);
    setPauseReason(null);
    setBanReason(null);
    setSuspensionReason(null);
    setSuspendedUntil(null);
    try {
      const res = await login(username.trim(), password, rememberMe);
      // BUG-001: handle MFA requirement before any redirect
      if (res?.mfa_required) {
        setMfaRequired(true);
        setMfaTempToken(res.temp_token ?? null);
        return;
      }
      if (res.user_role === "admin") {
        router.push("/admin");
      } else if (res.user_role === "seller") {
        router.push("/seller");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      // FIX #8: parse structured error codes (EMAIL_NOT_VERIFIED, ACCOUNT_PAUSED).
      // The api client stringifies object `detail` values into err.message.
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.code === "EMAIL_NOT_VERIFIED") {
            setErrorType("email_not_verified");
            setUnverifiedEmail(parsed.email || username.trim());
            setError(parsed.message);
            return;
          }
          if (parsed?.code === "ACCOUNT_PAUSED") {
            setErrorType("account_paused");
            setPauseReason(
              parsed.pause_reason || parsed.message ||
              "Your account has been paused."
            );
            setError(null);
            return;
          }
          if (parsed?.code === "ACCOUNT_BANNED") {
            setErrorType("account_banned");
            setBanReason(
              parsed.ban_reason || parsed.message ||
              "Your account has been permanently banned."
            );
            setError(null);
            return;
          }
          if (parsed?.code === "ACCOUNT_SUSPENDED") {
            setErrorType("account_suspended");
            setSuspensionReason(
              parsed.suspension_reason || parsed.message ||
              "Your account has been suspended."
            );
            setSuspendedUntil(parsed.suspended_until || null);
            setError(null);
            return;
          }
        } catch {
          // not JSON — fall through to plain error
        }
        setError(err.message);
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaTempToken || mfaCode.length < 6) return;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const verifyData = await authApi.mfaVerify(mfaTempToken, mfaCode);
      const userInfo = await authApi.me(verifyData.access_token);
      completeLogin(verifyData.access_token, userInfo.id, userInfo.username, userInfo.role);
      if (userInfo.role === "admin") router.push("/admin");
      else if (userInfo.role === "seller") router.push("/seller");
      else router.push("/dashboard");
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setMfaLoading(false);
    }
  }

  async function handleResendVerification() {
    const emailToUse = unverifiedEmail || username.trim();
    if (!emailToUse || resending) return;
    setResending(true);
    try {
      await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: emailToUse }),
      });
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  // BUG-001: MFA verification step
  if (mfaRequired) {
    return (
      <div className="max-w-[570px] w-full mx-auto rounded-xl bg-white shadow-md p-4 sm:p-7 xl:p-11 dark:bg-gray-800">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <ShieldCheck size={40} className="text-brand-500" />
          </div>
          <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
            Two-Factor Authentication
          </h2>
          <p className="text-gray-500 dark:text-gray-400">Enter the 6-digit code from your authenticator app</p>
        </div>
        {mfaError && (
          <div className="mb-5 p-3 rounded-lg bg-error-50 border border-error-200 dark:bg-error-500/10 dark:border-error-500/20">
            <p className="text-sm text-error-600 dark:text-error-400">{mfaError}</p>
          </div>
        )}
        <form onSubmit={handleMfaSubmit}>
          <div className="mb-5">
            <label className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              className="rounded-xl border border-gray-300 bg-gray-50 placeholder:text-gray-400 w-full py-3 px-5 text-center text-base text-xl tracking-[0.5em] outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={mfaLoading || mfaCode.length < 6}
            className="btn-primary w-full mt-6"
          >
            {mfaLoading ? "Verifying..." : "Verify Code"}
          </button>
          <button
            type="button"
            onClick={() => { setMfaRequired(false); setMfaTempToken(null); setMfaCode(""); setMfaError(null); }}
            className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ← Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-[570px] w-full mx-auto rounded-xl bg-white shadow-md p-4 sm:p-7 xl:p-11 dark:bg-gray-800">
      {/* Heading */}
      <div className="text-center mb-8">
        <h2 className="font-bold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
          Sign In to Your Account
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Enter your details below</p>
      </div>

      {/* Verified banner */}
      {verifiedBanner && (
        <div className="mb-5 flex items-center gap-2 p-3 rounded-lg bg-success-50 border border-success-200 dark:bg-success-500/10 dark:border-success-500/20">
          <CheckCircle size={16} className="text-success-500 flex-shrink-0" />
          <p className="text-sm text-success-700 dark:text-success-400 font-medium">
            Email verified — you can now log in.
          </p>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="mb-5 p-3 rounded-lg bg-error-50 border border-error-200 dark:bg-error-500/10 dark:border-error-500/20">
          <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
        </div>
      )}

      {/* FIX #8: ACCOUNT_PAUSED — render structured pause state, not raw JSON */}
      {errorType === "account_paused" && (
        <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
            Account Paused
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            {pauseReason}
          </p>
          <p className="text-xs text-amber-500 mt-1">
            Contact support:{" "}
            <a href={SUPPORT_MAILTO} className="underline">
              {SUPPORT_EMAIL || "support"}
            </a>
          </p>
        </div>
      )}

      {/* ACCOUNT_BANNED — permanent, no self-service path */}
      {errorType === "account_banned" && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm font-bold text-red-700 dark:text-red-400">
            Account Permanently Banned
          </p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
            Reason: {banReason}
          </p>
          <p className="text-xs text-red-500 mt-1">
            This decision is final. To appeal, email{" "}
            <a href={SUPPORT_MAILTO} className="underline">
              {SUPPORT_EMAIL || "support"}
            </a>{" "}
            within 14 days.
          </p>
        </div>
      )}

      {/* ACCOUNT_SUSPENDED — blocked until admin restores (or until date) */}
      {errorType === "account_suspended" && (
        <div className="mb-5 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
          <p className="text-sm font-bold text-orange-700 dark:text-orange-400">
            Account Suspended
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
            Reason: {suspensionReason}
          </p>
          {suspendedUntil ? (
            <p className="text-xs text-orange-500 mt-1">
              Suspended until {new Date(suspendedUntil).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}.
            </p>
          ) : (
            <p className="text-xs text-orange-500 mt-1">
              You can&apos;t sign in until an admin lifts the suspension.
            </p>
          )}
          <p className="text-xs text-orange-500 mt-1">
            To appeal, email{" "}
            <a href={SUPPORT_MAILTO} className="underline">
              {SUPPORT_EMAIL || "support"}
            </a>
            .
          </p>
        </div>
      )}

      {/* EMAIL_NOT_VERIFIED action */}
      {unverifiedEmail && (
        <div className="mb-5 p-3 rounded-lg bg-warning-50 border border-warning-200 dark:bg-warning-500/10 dark:border-warning-500/20">
          {resent ? (
            <p className="text-sm text-success-700 dark:text-success-400 font-medium">
              A new verification link was sent — check your inbox.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="inline-flex items-center gap-2 text-sm font-medium text-warning-700 dark:text-warning-400 hover:underline disabled:opacity-60"
            >
              <MailCheck size={15} />
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Username */}
        <div className="mb-5">
          <label htmlFor="username" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Email or Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            placeholder="Enter your email or username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="campify-input w-full text-base"
          />
        </div>

        {/* Password */}
        <div className="mb-5">
          <label htmlFor="password" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="campify-input w-full pr-12 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2 mt-1">
          <input
            id="remember_me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="remember_me" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            Remember me for 30 days
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full mt-6"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>

        <Link
          href="/forgot-password"
          className="block text-center text-gray-400 mt-4 text-sm ease-out duration-200 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Forgot your password?
        </Link>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
