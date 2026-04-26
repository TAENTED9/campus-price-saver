"use client";

import React, { useRef, useState } from "react";
import { Upload, CircleCheck } from "lucide-react";
import { verificationApi, uploadApi } from "@/lib/api";

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
  label, hint, accept, file, onChange, uploading,
}: {
  label: string; hint: string; accept: string;
  file: File | null; onChange: (f: File) => void; uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className={`w-full flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 text-sm transition-colors ${
          file
            ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 hover:border-brand-400"
        }`}
      >
        <Upload size={16} className="flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {uploading ? "Uploading…" : file ? file.name : hint}
        </span>
        {file && <CircleCheck size={15} className="text-brand-500 flex-shrink-0" />}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden" title={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
    </div>
  );
}

export function VerificationSubmitForm({ token, userName, userEmail, userId, isWelcome, onDone, isResubmission }: {
  token: string;
  userName: string;
  userEmail: string;
  userId: number;
  isWelcome: boolean;
  onDone: () => void;
  isResubmission?: boolean;
}) {
  const [matric, setMatric] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("pendingMatric") || "";
    return "";
  });
  const [faculty, setFaculty] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [portalFile, setPortalFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingPortal, setUploadingPortal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [matricError, setMatricError] = useState<string | null>(null);

  const handleMatricChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9/A-Z]/gi, "").slice(0, 15).toUpperCase();
    setMatric(val);
    if (matricError) setMatricError(validateMatric(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const mErr = validateMatric(matric);
    if (mErr) { setMatricError(mErr); return; }

    if (!idFile) { setError("Student ID Card is required."); return; }
    if (!portalFile) { setError("Student Portal Screenshot is required."); return; }

    setIsLoading(true);
    let docUrl: string | null = null;
    let prtUrl: string | null = null;

    try {
      setUploadingId(true);
      docUrl = await uploadApi.uploadSellerIdCard(token, idFile).catch(() => null);
      setUploadingId(false);

      setUploadingPortal(true);
      prtUrl = await uploadApi.uploadPortalScreenshot(token, portalFile).catch(() => null);
      setUploadingPortal(false);

      await verificationApi.submit({
        seller_name: userName,
        matric_no: matric.trim().toUpperCase(),
        faculty: faculty.trim() || "Not specified",
        business_name: userName,
        business_category: businessCategory || undefined,
        pickup_location: pickupLocation.trim() || undefined,
        document_url: docUrl || undefined,
        portal_screenshot_url: prtUrl || undefined,
        email: userEmail,
        user_id: Number(userId),
      }, token);

      localStorage.removeItem("pendingMatric");
      setSuccess("Verification submitted! An admin will review your details shortly.");
      setTimeout(() => onDone(), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsLoading(false);
      setUploadingId(false);
      setUploadingPortal(false);
    }
  };

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
        {success && (
          <div className="mb-5 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/20 flex items-center gap-2">
            <CircleCheck size={18} className="text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">{success}</p>
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
              onChange={setIdFile}
              uploading={uploadingId}
            />
            <FileUploadField
              label="Student Portal Screenshot (required)"
              hint="Screenshot of your UNILAG student portal showing your details"
              accept="image/jpeg,image/png,image/webp"
              file={portalFile}
              onChange={setPortalFile}
              uploading={uploadingPortal}
            />
            <p className="text-xs text-gray-400">Max 5 MB per file. Used only for verification.</p>
          </div>

          <button
            type="submit"
            disabled={isLoading || uploadingId || uploadingPortal}
            className="w-full flex justify-center items-center font-semibold text-white bg-brand-500 py-3 px-6 rounded-full hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Submitting…" : isResubmission ? "Resubmit Verification" : "Submit Verification"}
          </button>
        </form>
      </div>
    </div>
  );
}
