"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { uploadApi, sellerApi } from "@/lib/api";
import {
  CheckCircle, Circle, ShieldCheck, Upload, Info,
  Clock, XCircle, ChevronRight, ChevronLeft, ListPlus,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const MATRIC_RE = /^\d{9}(\/[A-Z]{2,5})?$/;

function validateMatric(v: string): string | null {
  if (!v.trim()) return "Matric number is required.";
  if (!MATRIC_RE.test(v.trim().toUpperCase()))
    return "Format: 9 digits, e.g. 210101001";
  return null;
}

const STEPS = ["Matric Number", "Documents", "Review & Submit"] as const;

// ── Reusable atoms ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                done    ? "bg-brand-500 text-white" :
                active  ? "bg-brand-500 text-white ring-4 ring-brand-100 dark:ring-brand-500/20" :
                          "bg-gray-100 dark:bg-gray-800 text-gray-400"
              }`}>
                {done ? <CheckCircle size={18} /> : <Circle size={18} className={active ? "fill-white" : ""} />}
              </div>
              <span className={`text-[11px] font-semibold whitespace-nowrap ${
                active ? "text-brand-500" : done ? "text-gray-600 dark:text-gray-400" : "text-gray-400"
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mb-5 mx-1 rounded-full transition-colors ${
                done ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface DocUploadProps {
  label: string;
  hint: string;
  file: File | null;
  preview: string;
  uploading: boolean;
  onFile: (f: File) => void;
}
function DocUpload({ label, hint, file, preview, uploading, onFile }: DocUploadProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className={`w-full rounded-2xl border-2 border-dashed p-4 flex items-center gap-3 transition-colors text-left ${
          file
            ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10"
            : "border-gray-200 dark:border-gray-700 hover:border-brand-300 bg-gray-50 dark:bg-gray-800/50"
        }`}
      >
        {preview ? (
          <img src={preview} alt="preview" className="w-16 h-16 object-cover rounded-xl flex-shrink-0 border border-gray-200 dark:border-gray-700" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Upload size={20} className="text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${file ? "text-brand-600 dark:text-brand-400" : "text-gray-600 dark:text-gray-400"}`}>
            {uploading ? "Uploading…" : file ? file.name : hint}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">JPEG, PNG · Max 5MB</p>
        </div>
        {file && !uploading && <CheckCircle size={18} className="text-brand-500 flex-shrink-0" />}
        {uploading && <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" title={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SellerVerifyPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const isWelcome = params.get("ref") === "welcome";

  const [step, setStep]             = useState(1);
  const [submitted, setSubmitted]   = useState(false);

  // Step 1 state
  // FIX #5 / Block 2: matric is passed through as a URL search param from
  // signup, never written to client storage.
  const [matric, setMatric]         = useState(() => params.get("matric") || "");
  const [matricError, setMatricError] = useState<string | null>(null);

  // Step 2 state
  const [idFile, setIdFile]         = useState<File | null>(null);
  const [idPreview, setIdPreview]   = useState("");
  const [idUrl, setIdUrl]           = useState("");
  const [uploadingId, setUploadingId] = useState(false);

  const [portalFile, setPortalFile]     = useState<File | null>(null);
  const [portalPreview, setPortalPreview] = useState("");
  const [portalUrl, setPortalUrl]       = useState("");
  const [uploadingPortal, setUploadingPortal] = useState(false);

  // Step 3 state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/signin?redirect=/seller/verify");
  }, [isLoading, user, router]);

  function handleMatricChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9/A-Z]/gi, "").slice(0, 15).toUpperCase();
    setMatric(v);
    if (matricError) setMatricError(validateMatric(v));
  }

  function handleMatricBlur() {
    const err = validateMatric(matric);
    setMatricError(err);
    // Block 2: no client storage. Matric stays in component state and the
    // URL param. Reloading the page preserves it via the search param.
  }

  async function uploadId(file: File) {
    if (!token) return;
    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
    setUploadingId(true);
    try {
      const url = await uploadApi.uploadSellerIdCard(token, file);
      setIdUrl(url);
    } catch {
      setIdUrl("");
    } finally {
      setUploadingId(false);
    }
  }

  async function uploadPortal(file: File) {
    if (!token) return;
    setPortalFile(file);
    setPortalPreview(URL.createObjectURL(file));
    setUploadingPortal(true);
    try {
      const url = await uploadApi.uploadPortalScreenshot(token, file);
      setPortalUrl(url);
    } catch {
      setPortalUrl("");
    } finally {
      setUploadingPortal(false);
    }
  }

  function canProceedStep1() {
    return matric.trim().length >= 9 && !validateMatric(matric);
  }

  function canProceedStep2() {
    // FIX #7: both documents are required.
    return !!idUrl && !!portalUrl && !uploadingId && !uploadingPortal;
  }

  async function handleSubmit() {
    if (!token || !user) return;
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("matric_number", matric.trim().toUpperCase());
      fd.append("seller_name", user.display_name || user.username);
      fd.append("email", user.email || "");
      // FIX #6: user_id removed — backend reads identity from the JWT.
      // FIX #7: both URLs are required upstream; canProceedStep2 enforces it.
      fd.append("id_card_url", idUrl);
      fd.append("portal_url", portalUrl);
      await sellerApi.submitVerificationDocs(token, fd);
      setSubmitted(true);
    } catch (err) {
      // Structured backend errors come through as JSON-stringified `detail`
      // objects on err.message. Parse and surface a clean message.
      let msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.message) msg = parsed.message;
        } catch {
          // not JSON — keep raw err.message
        }
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success / submitted state ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center mx-auto mb-5">
              <Clock size={32} className="text-warning-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Under Review</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your verification documents have been submitted. We usually review within{" "}
              <strong className="text-gray-700 dark:text-gray-300">24 hours</strong>. You&apos;ll receive an email once done.
            </p>

            <div className="bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-400 mb-1">While you wait…</p>
              <p className="text-sm text-brand-600 dark:text-brand-300">
                You can prepare draft listings — they&apos;ll go live the moment you&apos;re verified.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/seller/listings/new"
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-400 text-white font-bold text-sm hover:opacity-90 transition-opacity">
                <ListPlus size={16} /> Prepare Draft Listings
              </Link>
              <Link href="/seller"
                className="py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-md shadow-brand-500/20">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Seller Verification</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Verified sellers get a badge, higher visibility, and buyer trust.
          </p>
        </div>

        {/* Welcome banner from apply redirect */}
        {isWelcome && (
          <div className="mb-5 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 p-4 flex items-start gap-3">
            <CheckCircle size={18} className="text-brand-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">Profile created!</p>
              <p className="text-sm text-brand-600 dark:text-brand-300 mt-0.5">
                Complete verification below to start listing products.
              </p>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ── STEP 1: Matric Number ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">Enter Your Matric Number</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This is a one-time entry. It will be cross-checked with our student database.
                </p>
              </div>
              <div>
                <label htmlFor="v-matric" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  UNILAG Matric Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="v-matric"
                  type="text"
                  placeholder="e.g. 210101001"
                  value={matric}
                  onChange={handleMatricChange}
                  onBlur={handleMatricBlur}
                  required
                  className={`w-full rounded-xl border px-4 py-3 text-sm bg-white dark:bg-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-colors ${
                    matricError
                      ? "border-red-400 focus:ring-red-500/20"
                      : "border-gray-200 dark:border-gray-700 focus:border-brand-400 focus:ring-brand-500/10"
                  }`}
                />
                {matricError
                  ? <p className="text-xs text-red-500 mt-1">{matricError}</p>
                  : <p className="text-xs text-gray-400 mt-1">Format: 9 digits, e.g. 210101001</p>}
              </div>
            </div>
          )}

          {/* ── STEP 2: Documents ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">Upload Documents</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Both documents are required for verification.</p>
              </div>

              <DocUpload
                label="UNILAG Student ID Card (Front) *"
                hint="Photo of your student ID card"
                file={idFile}
                preview={idPreview}
                uploading={uploadingId}
                onFile={uploadId}
              />

              <DocUpload
                label="Portal Screenshot *"
                hint="Screenshot showing Name + Matric + Current session"
                file={portalFile}
                preview={portalPreview}
                uploading={uploadingPortal}
                onFile={uploadPortal}
              />

              {/* Privacy notice */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Info size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Your documents are stored securely and only used for identity verification.
                  They are <strong className="text-gray-600 dark:text-gray-300">never shared with third parties</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Review & Submit ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">Review & Submit</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Confirm your details before submitting for review.</p>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {[
                  { label: "Matric Number", value: matric.toUpperCase(), mono: true },
                  { label: "Student ID Card", value: idFile ? `${idFile.name} ✓` : "Not uploaded" },
                  { label: "Portal Screenshot", value: portalFile ? `${portalFile.name} ✓` : "Not uploaded" },
                  { label: "Account", value: user?.display_name || user?.username || "" },
                ].map((r) => (
                  <div key={r.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide sm:w-40 shrink-0">{r.label}</span>
                    <span className={`text-sm text-gray-800 dark:text-white/90 ${r.mono ? "font-mono" : ""}`}>{r.value}</span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 flex items-start gap-2">
                <Clock size={14} className="text-warning-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-warning-700 dark:text-warning-400">
                  Review usually takes <strong>under 24 hours</strong>. You can prepare draft listings while waiting.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-4">
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <Link href="/seller/apply"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <ChevronLeft size={16} /> Apply
            </Link>
          )}

          <div className="flex-1" />

          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 ? !canProceedStep1() : !canProceedStep2()}
              onClick={() => {
                if (step === 1) {
                  const err = validateMatric(matric);
                  if (err) { setMatricError(err); return; }
                  // Block 2: keep the matric in the URL so reload survives it,
                  // never in localStorage.
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.set("matric", matric);
                    window.history.replaceState(null, "", url.toString());
                  }
                }
                setStep(step + 1);
              }}
              className="flex items-center gap-1.5 px-8 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-400 text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity shadow-md shadow-brand-500/20"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <><ShieldCheck size={16} /> Submit for Review</>
              )}
            </button>
          )}
        </div>

        {/* Rejection status widget (visible on resubmit) */}
        {/* Can be extended to show current status from sellerApi.getVerification() */}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-5">
          <Link href="/seller" className="text-brand-500 hover:underline">Skip for now</Link>
          {" — "}You can verify later from Settings
        </p>
      </div>
    </div>
  );
}
