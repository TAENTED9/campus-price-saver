"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Eye, EyeOff, ChevronLeft, ShoppingBag, Store, Check, MailCheck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls = (hasError?: boolean) =>
  `rounded-full border ${hasError ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50"} placeholder:text-gray-400 w-full py-3 px-5 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500`;

// ─── UNILAG matric validation ─────────────────────────────────────────────────
// UNILAG format: 9 digits (e.g. 190101001) or 9digits/2letters (e.g. 190101001/ED)
const MATRIC_REGEX = /^\d{9}(\/[A-Z]{2,4})?$/;
function validateMatric(value: string): string | null {
  if (!value) return "Matric number is required.";
  const clean = value.trim().toUpperCase();
  if (!MATRIC_REGEX.test(clean)) return "Format: 9 digits, e.g. 190101001 or 190101001/ED";
  return null;
}

// ─── Password strength ────────────────────────────────────────────────────────

function getStrength(password: string) {
  if (!password) return null;
  if (password.length < 4) return { label: "Too short", color: "bg-red-500", width: "w-1/4" };
  if (password.length < 6) return { label: "Weak", color: "bg-orange-400", width: "w-2/4" };
  if (password.length < 8) return { label: "Fair", color: "bg-yellow-400", width: "w-3/4" };
  return { label: "Strong", color: "bg-green-500", width: "w-full" };
}

type Role = "buyer" | "seller";

// ─── Shared card container ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[570px] w-full mx-auto rounded-xl bg-white shadow-md p-4 sm:p-7 xl:p-11 dark:bg-gray-800">
      {children}
    </div>
  );
}

// ─── Role Selection Screen ────────────────────────────────────────────────────

function RoleSelector({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <Card>
      <div className="text-center mb-8">
        <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
          Create an Account
        </h2>
        <p className="text-gray-500 dark:text-gray-400">How do you want to use Price Saver?</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Buyer card */}
        <button
          type="button"
          onClick={() => onSelect("buyer")}
          className="group flex flex-col items-start p-6 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-brand-500 hover:shadow-md transition-all duration-200 text-left dark:bg-gray-700 dark:border-gray-600 dark:hover:border-brand-500"
        >
          <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-200">
            <ShoppingBag size={24} />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white mb-1">I&apos;m a Buyer</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse and compare prices across campus.
          </p>
          <ul className="mt-4 space-y-1.5">
            {["Compare prices instantly", "Set price alerts", "Save favourite products"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-brand-50 flex items-center justify-center">
                  <Check size={8} className="text-brand-500" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </button>

        {/* Seller card */}
        <button
          type="button"
          onClick={() => onSelect("seller")}
          className="group flex flex-col items-start p-6 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-brand-500 hover:shadow-md transition-all duration-200 text-left dark:bg-gray-700 dark:border-gray-600 dark:hover:border-brand-500"
        >
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4 group-hover:bg-green-500 group-hover:text-white transition-colors duration-200">
            <Store size={24} />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white mb-1">I&apos;m a Seller</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            List products, reach UNILAG students.
          </p>
          <ul className="mt-4 space-y-1.5">
            {["Requires UNILAG matric", "Verified seller badge", "Analytics dashboard"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-50 flex items-center justify-center">
                  <Check size={8} className="text-green-500" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </button>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </Card>
  );
}

// ─── Buyer Form ───────────────────────────────────────────────────────────────

function BuyerForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After registration: show "check email" screen
  const [step, setStep] = useState<"form" | "check_email">("form");
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const strength = getStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!username.trim() || username.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!agreedToTerms) { setError("Please agree to the terms and conditions."); return; }

    setIsLoading(true);
    try {
      await authApi.register(username.trim(), password, email.trim());
      setStep("check_email");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  if (step === "check_email") {
    return (
      <Card>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <MailCheck size={28} className="text-brand-500" />
          </div>
          <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">Check your email</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            We sent a verification link to <strong>{email}</strong>.<br />
            Click the link in the email to activate your account.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          {resent ? (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">New link sent — check your inbox.</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm text-brand-500 hover:text-brand-600 disabled:opacity-60 transition-colors"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
          <Link href="/signin" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Back to Sign In
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-center mb-8">
        <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
          Create Buyer Account
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Quick setup — add more details from your profile later</p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-6 transition-colors"
      >
        <ChevronLeft size={16} className="mr-1" />
        Choose a different role
      </button>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label htmlFor="buyer-email" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="buyer-email"
            name="email"
            type="email"
            placeholder="student@unilag.edu.ng or personal@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls()}
          />
        </div>

        <div className="mb-5">
          <label htmlFor="buyer-username" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Username <span className="text-red-500">*</span>
          </label>
          <input
            id="buyer-username"
            name="username"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputCls()}
          />
          <p className="mt-1 text-xs text-gray-400">Min. 3 characters. This is how others will see you.</p>
        </div>

        <div className="mb-5">
          <label htmlFor="buyer-password" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="buyer-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputCls()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {strength && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full dark:bg-gray-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
              </div>
              <span className="text-xs text-gray-500">{strength.label}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 mb-5">
          <input
            id="buyer-terms"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="buyer-terms" className="text-sm text-gray-600 dark:text-gray-400">
            I agree to the{" "}
            <Link href="/terms" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Privacy Policy</Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || !agreedToTerms}
          className="w-full flex justify-center items-center font-medium text-white bg-gray-900 py-3 px-6 rounded-full ease-out duration-200 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-brand-500"
        >
          {isLoading ? "Creating account..." : "Create Buyer Account"}
        </button>
      </form>

      <div className="mt-5 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium">Sign In</Link>
        </p>
      </div>
    </Card>
  );
}

// ─── Seller Form ──────────────────────────────────────────────────────────────

function SellerForm({ onBack }: { onBack: () => void }) {
  const [matric, setMatric] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matricError, setMatricError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "check_email">("form");
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const strength = getStrength(password);

  const handleMatricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9/A-Z]/gi, "").slice(0, 15).toUpperCase();
    setMatric(val);
    if (matricError) setMatricError(validateMatric(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const mErr = validateMatric(matric);
    if (mErr) { setMatricError(mErr); return; }
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!username.trim() || username.length < 3) { setError("Store name must be at least 3 characters."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!agreedToTerms) { setError("Please agree to the terms and conditions."); return; }

    setIsLoading(true);
    try {
      await authApi.register(username.trim(), password, email.trim(), "seller");
      sessionStorage.setItem("pendingMatric", matric.trim().toUpperCase());
      setStep("check_email");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  async function handleResend() {
    if (resending) return;
    setResending(true);
    try {
      await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  if (step === "check_email") {
    return (
      <Card>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <MailCheck size={28} className="text-brand-500" />
          </div>
          <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
            Check your email
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            We sent a verification link to <strong>{email}</strong>.<br />
            After verifying, sign in and complete your seller verification.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          {resent ? (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">New link sent — check your inbox.</p>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending}
              className="text-sm text-brand-500 hover:text-brand-600 disabled:opacity-60 transition-colors">
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
          <Link href="/signin" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            Back to Sign In
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-center mb-8">
        <h2 className="font-semibold text-xl sm:text-2xl text-gray-900 dark:text-white mb-1.5">
          Create Seller Account
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Have your UNILAG matric ready — you&#39;ll verify your identity next</p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-6 transition-colors"
      >
        <ChevronLeft size={16} className="mr-1" />
        Choose a different role
      </button>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Matric */}
        <div className="mb-5">
          <label htmlFor="seller-matric" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            UNILAG Matric Number <span className="text-red-500">*</span>
          </label>
          <input
            id="seller-matric"
            name="matric"
            type="text"
            placeholder="e.g. 210101001"
            value={matric}
            onChange={handleMatricChange}
            onBlur={() => setMatricError(validateMatric(matric))}
            required
            className={inputCls(!!matricError)}
          />
          {matricError ? (
            <p className="mt-1 text-xs text-red-500">{matricError}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">9-digit format, e.g. 210101001</p>
          )}
        </div>

        {/* Email */}
        <div className="mb-5">
          <label htmlFor="seller-email" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="seller-email"
            name="email"
            type="email"
            placeholder="student@unilag.edu.ng or personal@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls()}
          />
        </div>

        {/* Store name */}
        <div className="mb-5">
          <label htmlFor="seller-username" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Store / Brand Name <span className="text-red-500">*</span>
          </label>
          <input
            id="seller-username"
            name="username"
            type="text"
            placeholder="Your store or brand name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputCls()}
          />
          <p className="mt-1 text-xs text-gray-400">Min. 3 characters. This is your public store name.</p>
        </div>

        {/* Password */}
        <div className="mb-5">
          <label htmlFor="seller-password" className="block mb-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="seller-password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputCls()}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {strength && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full dark:bg-gray-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
              </div>
              <span className="text-xs text-gray-500">{strength.label}</span>
            </div>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3 mb-5">
          <input
            id="seller-terms"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          <label htmlFor="seller-terms" className="text-sm text-gray-600 dark:text-gray-400">
            I agree to the{" "}
            <Link href="/terms" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Privacy Policy</Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || !agreedToTerms}
          className="w-full flex justify-center items-center font-medium text-white bg-gray-900 py-3 px-6 rounded-full ease-out duration-200 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-brand-500"
        >
          {isLoading ? "Creating account..." : "Continue →"}
        </button>
      </form>

      <div className="mt-5 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium">Sign In</Link>
        </p>
      </div>
    </Card>
  );
}

// ─── Main SignUpForm (orchestrator) ───────────────────────────────────────────

export default function SignUpForm() {
  const [role, setRole] = useState<Role | null>(null);

  return (
    <div>
      {/* Step indicator */}
      <div className="max-w-[570px] w-full mx-auto mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors ${!role ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400"}`}>1</div>
          <div className={`flex-1 h-0.5 transition-colors ${role ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors ${role ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"}`}>2</div>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">Choose role</span>
          <span className="text-xs text-gray-500">Your details</span>
        </div>
      </div>

      {!role && <RoleSelector onSelect={setRole} />}
      {role === "buyer" && <BuyerForm onBack={() => setRole(null)} />}
      {role === "seller" && <SellerForm onBack={() => setRole(null)} />}
    </div>
  );
}
