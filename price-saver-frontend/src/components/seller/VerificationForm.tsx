"use client";

import React, { useRef, useState } from "react";
import { Upload, CircleCheck, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { verificationApi, uploadApi } from "@/lib/api";

type UploadState = "idle" | "uploading" | "done" | "error";

export const inp =
  "rounded-full border border-gray-300 bg-gray-50 placeholder:text-gray-400 w-full py-3 px-5 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:[color-scheme:dark] dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500";

export const BUSINESS_CATEGORIES = [
  "Food & Groceries", "Fashion & Clothing", "Electronics & Gadgets",
  "Books & Stationery", "Beauty & Personal Care", "Home & Kitchen",
  "Health & Wellness", "Services", "Other",
];

const MATRIC_REGEX = /^\d{9}(\/[A-Z]{2,4})?$/;

export function validateMatric(value: string): string | null {
  if (!value) return "Matric number is required.";
  const clean = value.trim().toUpperCase();
  if (!MATRIC_REGEX.test(clean)) return "Format: 9 digits, e.g. 190101001 or 190101001/ED";
  return null;
}

export function FileUploadField({
  label, hint, accept, file, onChange, uploadState, onRetry,
}: {
  label: string; hint: string; accept: string;
  file: File | null; onChange: (f: File) => void;
  uploadState: UploadState; onRetry?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const borderClass =
    uploadState === "done"    ? "border-green-400 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" :
    uploadState === "error"   ? "border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
    uploadState === "uploading" ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 animate-pulse" :
    file ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
         : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:border-brand-400";

  const label_text =
    uploadState === "uploading" ? "Uploading… please wait" :
    uploadState === "done"      ? `✓ ${file?.name ?? "Uploaded"}` :
    uploadState === "error"     ? `Upload failed — ${file?.name ?? "file"}` :
    file ? file.name : hint;

  return (
    <div>
      <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploadState === "uploading"}
          className={`flex-1 flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 text-sm transition-colors ${borderClass}`}
        >
          {uploadState === "uploading" ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent flex-shrink-0" />
          ) : uploadState === "done" ? (
            <CircleCheck size={16} className="flex-shrink-0 text-green-500" />
          ) : uploadState === "error" ? (
            <AlertCircle size={16} className="flex-shrink-0" />
          ) : (
            <Upload size={16} className="flex-shrink-0" />
          )}
          <span className="flex-1 text-left truncate">{label_text}</span>
        </button>
        {uploadState === "error" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            title="Retry upload"
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 transition-colors"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        )}
      </div>
      {uploadState === "error" && (
        <p className="mt-1 text-xs text-red-500">Upload failed. Check your connection and retry.</p>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" title={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
    </div>
  );
}

function SubmittedSuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03] text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-warning-50 dark:bg-warning-500/10">
            <Clock className="size-8 text-warning-500" strokeWidth={1.5} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">
            We&apos;ve received your verification details
          </h2>
          <p className="text-base font-medium text-warning-600 dark:text-warning-400">
            Hold on shortly while our team approve you for listing.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-left space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold">Please note:</span> If your details are incorrect or false, you will be denied approval.
            You can then return to submit the correct details.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Approvals are typically completed within 24 hours on working days. You&apos;ll receive an email once a decision is made.
          </p>
        </div>
        <div className="flex items-center gap-2 justify-center pt-1">
          <CircleCheck size={16} className="text-green-500" />
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">Documents submitted successfully</span>
        </div>
        <button
          onClick={onDone}
          className="w-full font-semibold text-white bg-brand-500 py-3 px-6 rounded-full hover:bg-brand-600 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export function VerificationSubmitForm({ token, userName, userEmail, isWelcome, onDone, isResubmission }: {
  token: string;
  userName: string;
  userEmail: string;
  /** FIX #6: caller may still pass userId for back-compat — it is ignored. */
  userId?: number;
  isWelcome: boolean;
  onDone: () => void;
  isResubmission?: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);

  // Block 2: no client storage. Matric is captured from the URL search
  // param when the seller arrives from signup → /seller/verify?matric=…
  const [matric, setMatric] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const sp = new URLSearchParams(window.location.search);
    return sp.get("matric") || "";
  });
  const [faculty, setFaculty] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");

  const [idFile, setIdFile] = useState<File | null>(null);
  const [portalFile, setPortalFile] = useState<File | null>(null);
  const [idUploadState, setIdUploadState] = useState<UploadState>("idle");
  const [portalUploadState, setPortalUploadState] = useState<UploadState>("idle");
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matricError, setMatricError] = useState<string | null>(null);

  const handleMatricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9/A-Z]/gi, "").slice(0, 15).toUpperCase();
    setMatric(val);
    if (matricError) setMatricError(validateMatric(val));
  };

  const uploadIdFile = async (file: File) => {
    setIdUploadState("uploading");
    setIdUrl(null);
    try {
      const url = await uploadApi.uploadSellerIdCard(token, file);
      setIdUrl(url);
      setIdUploadState("done");
    } catch {
      setIdUploadState("error");
    }
  };

  const uploadPortalFile = async (file: File) => {
    setPortalUploadState("uploading");
    setPortalUrl(null);
    try {
      const url = await uploadApi.uploadPortalScreenshot(token, file);
      setPortalUrl(url);
      setPortalUploadState("done");
    } catch {
      setPortalUploadState("error");
    }
  };

  const handleIdChange = (f: File) => {
    setIdFile(f);
    setIdUploadState("idle");
    setIdUrl(null);
    uploadIdFile(f);
  };

  const handlePortalChange = (f: File) => {
    setPortalFile(f);
    setPortalUploadState("idle");
    setPortalUrl(null);
    uploadPortalFile(f);
  };

  const canSubmit =
    idUploadState === "done" &&
    portalUploadState === "done" &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const mErr = validateMatric(matric);
    if (mErr) { setMatricError(mErr); return; }
    if (!idFile) { setError("Student ID Card is required."); return; }
    if (!portalFile) { setError("Portal screenshot is required."); return; }
    if (idUploadState !== "done" || !idUrl) { setError("Please wait for the ID card upload to finish or retry."); return; }
    if (portalUploadState !== "done" || !portalUrl) { setError("Please wait for the portal upload to finish or retry."); return; }

    setIsSubmitting(true);
    try {
      await verificationApi.submit({
        seller_name: userName,
        matric_no: matric.trim().toUpperCase(),
        faculty: faculty.trim() || "Not specified",
        business_name: userName,
        business_category: businessCategory || undefined,
        pickup_location: pickupLocation.trim() || undefined,
        document_url: idUrl,
        portal_screenshot_url: portalUrl,
        email: userEmail,
        // FIX #6: user_id removed from request — backend reads identity
        // from the JWT (current_user). Kept on the type signature for
        // back-compat but no longer wired through.
      }, token);

      // Block 2: matric was never written to localStorage — nothing to clear.
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return <SubmittedSuccessScreen onDone={onDone} />;
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {isWelcome && (
        <div className="rounded-xl border border-brand-300 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-xs">🎉</span>
            <div>
              <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">Account created! One more step.</p>
              <p className="text-sm text-brand-600 dark:text-brand-300 mt-0.5">
                Complete your seller verification to start listing products.
              </p>
            </div>
          </div>
        </div>
      )}
      {isResubmission && (
        <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10">
          <p className="text-sm font-semibold text-warning-700 dark:text-warning-400">
            Your previous submission was rejected. Please correct the issues and resubmit.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-500/10">
            <svg className="size-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11.25 14.25 15 9" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white/90">Complete Seller Verification</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Verified sellers get a badge and higher visibility</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vf-matric" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              UNILAG Matric Number <span className="text-red-500">*</span>
            </label>
            <input
              id="vf-matric"
              type="text"
              placeholder="e.g. 190101001 or 190101001/ED"
              value={matric}
              onChange={handleMatricChange}
              onBlur={() => setMatricError(validateMatric(matric))}
              required
              className={`${inp} ${matricError ? "border-red-400 bg-red-50" : ""}`}
            />
            {matricError
              ? <p className="mt-1 text-xs text-red-500">{matricError}</p>
              : <p className="mt-1 text-xs text-gray-400">9-digit format, e.g. 190101001 or 190101001/ED</p>}
          </div>

          <div>
            <label htmlFor="vf-faculty" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Faculty / Department
            </label>
            <input
              id="vf-faculty"
              type="text"
              placeholder="e.g. Engineering, Sciences, Law..."
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className={inp}
            />
          </div>

          <div>
            <label htmlFor="vf-category" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Business Category
            </label>
            <select
              id="vf-category"
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
              className={inp}
            >
              <option value="">Select a category…</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="vf-pickup" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Pickup / Delivery Location
            </label>
            <input
              id="vf-pickup"
              type="text"
              placeholder="e.g. Faculty of Engineering, Block B, Room 105"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className={inp}
            />
            <p className="mt-1 text-xs text-gray-400">Where buyers can collect orders on campus</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Documents</p>
            <FileUploadField
              label="Student ID Card *"
              hint="Upload a photo of your student ID card (JPEG/PNG)"
              accept="image/jpeg,image/png,image/webp"
              file={idFile}
              onChange={handleIdChange}
              uploadState={idUploadState}
              onRetry={() => idFile && uploadIdFile(idFile)}
            />
            <FileUploadField
              label="Student Portal Screenshot (required)"
              hint="Screenshot of your UNILAG student portal showing your details"
              accept="image/jpeg,image/png,image/webp"
              file={portalFile}
              onChange={handlePortalChange}
              uploadState={portalUploadState}
              onRetry={() => portalFile && uploadPortalFile(portalFile)}
            />
            <p className="text-xs text-gray-400">Max 5 MB per file. Used only for verification.</p>
            {(idUploadState === "uploading" || portalUploadState === "uploading") && (
              <p className="text-xs text-brand-500 font-medium">Uploading files… the submit button will unlock when both uploads are complete.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex justify-center items-center font-semibold text-white bg-brand-500 py-3 px-6 rounded-full hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Submitting…" : isResubmission ? "Resubmit Verification" : "Submit Verification"}
          </button>
        </form>
      </div>
    </div>
  );
}
