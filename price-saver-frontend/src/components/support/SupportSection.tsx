"use client";

import { useState, useEffect } from "react";
import {
  MessageCircle,
  X,
  Send,
  CheckCircle2,
  Loader2,
  HelpCircle,
  AlertCircle,
  Lightbulb,
  Bug,
  ShoppingBag,
  CreditCard,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CategoryValue =
  | "account_issue"
  | "seller_verification"
  | "listing_issue"
  | "order_dispute"
  | "payment_issue"
  | "bug_report"
  | "feature_request"
  | "other";

interface Category {
  value: CategoryValue;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  desc: string;
}

const CATEGORIES: Category[] = [
  { value: "account_issue",       label: "Account Issue",       icon: Shield,         desc: "Login, password, profile problems" },
  { value: "seller_verification", label: "Seller Verification", icon: CheckCircle2,   desc: "Verification status or documents" },
  { value: "listing_issue",       label: "Listing Issue",       icon: ShoppingBag,    desc: "Problem with a product listing" },
  { value: "order_dispute",       label: "Order Dispute",       icon: AlertCircle,    desc: "Issue with a transaction or meetup" },
  { value: "payment_issue",       label: "Payment Issue",       icon: CreditCard,     desc: "Payment or pricing concerns" },
  { value: "bug_report",          label: "Bug Report",          icon: Bug,            desc: "Something is broken on the site" },
  { value: "feature_request",     label: "Feature Request",     icon: Lightbulb,      desc: "Suggest an improvement" },
  { value: "other",               label: "Other",               icon: HelpCircle,     desc: "Anything else" },
];

export interface SupportSectionProps {
  /**
   * banner   — full-width strip (homepage / footer area)
   * floating — fixed bottom-right pill button (every page)
   * inline   — card placed inside a sidebar or page section
   */
  variant?: "banner" | "floating" | "inline";
}

export function SupportSection({ variant = "banner" }: SupportSectionProps) {
  // useAuth may run in a Provider-wrapped tree; we tolerate undefined for SSR safety.
  let authUser: { display_name?: string; username?: string; email?: string } | null = null;
  try {
    authUser = useAuth().user;
  } catch {
    authUser = null;
  }

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Floating-button behavior: collapse to a circle while scrolling down, and
  // hide entirely while a text field is focused (so it never fights the mobile
  // keyboard or covers a form). Only wired up for the floating variant.
  const [collapsed, setCollapsed] = useState(false);
  const [hiddenByInput, setHiddenByInput] = useState(false);

  useEffect(() => {
    if (variant !== "floating") return;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setCollapsed(y > lastY && y > 120);
      lastY = y;
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) setHiddenByInput(true);
    };
    const onFocusOut = () => setHiddenByInput(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [variant]);

  // Hydration safety: only render interactive components after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState<string>(authUser?.display_name || authUser?.username || "");
  const [email, setEmail] = useState<string>(authUser?.email || "");
  const [category, setCategory] = useState<CategoryValue | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function reset() {
    setStep("form");
    setError(null);
    setCategory("");
    setSubject("");
    setMessage("");
    // Keep name + email pre-filled for quick re-submits
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !category || !subject || !message) {
      setError("Please fill in all fields");
      return;
    }
    if (message.trim().length < 20) {
      setError("Please add more detail (at least 20 characters).");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/support/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          category,
          subject,
          message,
          page_url: typeof window !== "undefined" ? window.location.href : null,
        }),
      });

      if (res.status === 429) {
        setError("Too many messages. Please wait an hour and try again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { detail?: unknown }));
        const detail = (data as { detail?: unknown }).detail;
        const msg = Array.isArray(detail)
          ? detail.map((it) => (it as { msg?: string }).msg).filter(Boolean).join(", ")
          : typeof detail === "string"
            ? detail
            : "Failed to send message";
        setError(msg);
        return;
      }

      setStep("success");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── MODAL ────────────────────────────────────────────────────────
  const modal =
    open && (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 bg-white dark:bg-gray-900 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <MessageCircle size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-base">
                  Contact Support
                </h2>
                <p className="text-xs text-gray-400">We reply within 24 hours</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {step === "success" ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                Message sent!
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                We&apos;ll reply to{" "}
                <strong className="text-gray-700 dark:text-gray-300">{email}</strong>{" "}
                within 24 hours.
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Check your inbox for a confirmation email.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30 min-h-[44px]"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl hover:opacity-90 min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Name + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kola Adeolu"
                    required
                    maxLength={100}
                    className="w-full h-11 px-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                    className="w-full h-11 px-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  What&apos;s this about?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const active = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all min-h-[60px] ${
                          active
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <Icon
                          size={14}
                          className={`mt-0.5 flex-shrink-0 ${
                            active
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-400"
                          }`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-bold ${
                              active
                                ? "text-blue-700 dark:text-blue-300"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {cat.label}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                            {cat.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  required
                  minLength={5}
                  maxLength={200}
                  className="w-full h-11 px-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or feedback in detail. The more detail you provide, the faster we can help."
                  required
                  rows={5}
                  minLength={20}
                  maxLength={3000}
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">
                  {message.length}/3000
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {error}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !category}
                className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Message
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                We&apos;ll reply to your email within 24 hours. You&apos;ll also receive a
                confirmation email.
              </p>
            </form>
          )}
        </div>
      </div>
    );

  // ── FLOATING BUTTON ────────────────────────────────────────────
  // Only render after mount to prevent hydration mismatch
  if (variant === "floating") {
    if (!mounted) return null;
    return (
      <>
        {modal}
        {/* Non-blocking layer: pointer-events-none lets clicks pass straight
            through the empty area to whatever is underneath; only the button
            itself is interactive. */}
        <div className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-40 pointer-events-none">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Contact support"
            className={`pointer-events-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[44px] ${
              hiddenByInput
                ? "opacity-0 translate-y-6 pointer-events-none"
                : "opacity-90 hover:opacity-100"
            } ${collapsed ? "w-12 h-12 p-0" : "px-4 py-3"}`}
          >
            <MessageCircle size={18} className="shrink-0" />
            {!collapsed && <span className="hidden sm:inline">Need help?</span>}
          </button>
        </div>
      </>
    );
  }

  // ── BANNER ─────────────────────────────────────────────────────
  if (variant === "banner") {
    return (
      <>
        {modal}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 py-4 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3 text-white">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base">
                  Need help or found an issue?
                </p>
                <p className="text-blue-100 text-xs sm:text-sm">
                  Contact our support team — we reply within 24 hours
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 font-bold text-sm rounded-xl hover:bg-blue-50 transition-all whitespace-nowrap min-h-[44px]"
            >
              <MessageCircle size={15} />
              Contact Support
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── INLINE CARD ────────────────────────────────────────────────
  return (
    <>
      {modal}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <HelpCircle size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-gray-900 dark:text-white text-sm mb-1">
              Need help?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
              Having an issue, found a bug, or have feedback? Our support team typically
              responds within 24 hours.
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline min-h-[32px]"
            >
              <MessageCircle size={13} />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default SupportSection;
