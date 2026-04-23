"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, verificationApi, uploadApi, type SellerVerificationData } from "@/lib/api";
import { Upload, CircleCheck } from "lucide-react";

type VerificationObj = Exclude<SellerVerificationData, null>;

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6";

const inp =
  "rounded-full border border-gray-300 bg-gray-50 placeholder:text-gray-400 w-full py-3 px-5 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:[color-scheme:dark] dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500";

const BUSINESS_CATEGORIES = [
  "Food & Groceries", "Fashion & Clothing", "Electronics & Gadgets",
  "Books & Stationery", "Beauty & Personal Care", "Home & Kitchen",
  "Health & Wellness", "Services", "Other",
];

const MATRIC_REGEX = /^\d{9}(\/[A-Z]{2,4})?$/;
function validateMatric(value: string): string | null {
  if (!value) return "Matric number is required.";
  const clean = value.trim().toUpperCase();
  if (!MATRIC_REGEX.test(clean)) return "Format: 9 digits, e.g. 190101001 or 190101001/ED";
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11.25 14.25 15 9" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  );
}

function FileUploadField({
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

// ─── Verification Submit Form (shown when no verification exists) ──────────────

function VerificationSubmitForm({ token, userName, userEmail, userId, isWelcome, onDone }: {
  token: string;
  userName: string;
  userEmail: string;
  userId: number;
  isWelcome: boolean;
  onDone: () => void;
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
      });

      localStorage.removeItem("pendingMatric");
      setSuccess("Verification submitted successfully! An admin will review your details shortly.");
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

      <div className={CARD}>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-500/10">
            <ShieldCheckIcon className="size-5 text-brand-500" />
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
          {/* Matric */}
          <div>
            <label htmlFor="v-matric" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              UNILAG Matric Number <span className="text-red-500">*</span>
            </label>
            <input
              id="v-matric"
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

          {/* Faculty */}
          <div>
            <label htmlFor="v-faculty" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Faculty / Department
            </label>
            <input
              id="v-faculty"
              type="text"
              placeholder="e.g. Engineering, Sciences, Law..."
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className={inp}
            />
          </div>

          {/* Business Category */}
          <div>
            <label htmlFor="v-category" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Business Category
            </label>
            <select
              id="v-category"
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
              className={inp}
            >
              <option value="">Select a category…</option>
              {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Pickup Location */}
          <div>
            <label htmlFor="v-pickup" className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Pickup / Delivery Location
            </label>
            <input
              id="v-pickup"
              type="text"
              placeholder="e.g. Faculty of Engineering, Block B, Room 105"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className={inp}
            />
            <p className="mt-1 text-xs text-gray-400">Where buyers can collect orders on campus</p>
          </div>

          {/* Documents */}
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
            {isLoading ? "Submitting…" : "Submit Verification"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Want to do this later?{" "}
        <Link href="/seller" className="text-brand-500 hover:text-brand-600 font-medium">Go to dashboard</Link>
      </p>
    </div>
  );
}

// ─── Progress tracker & other sub-components ─────────────────────────────────

function ProgressTracker({ status }: { status: string }) {
  const isRejected = status === "Rejected";
  const isApproved = status === "Approved";
  const isUnderReview = status === "Under Review";

  const steps = [
    { label: "Submitted", complete: true },
    { label: "Under Review", complete: isUnderReview || isApproved || isRejected },
    { label: isRejected ? "Rejected" : "Approved", complete: isApproved || isRejected, rejected: isRejected },
  ];

  const currentIdx = steps.findIndex((s) => !s.complete);
  const activeIdx = currentIdx === -1 ? steps.length - 1 : currentIdx;

  return (
    <div className={CARD}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-6">Verification Progress</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isCurrent = i === activeIdx && !step.complete;
          let circleClasses: string;
          let icon: React.ReactNode;
          if (step.rejected) {
            circleClasses = "bg-error-500 text-white";
            icon = <XIcon className="size-4" />;
          } else if (step.complete) {
            circleClasses = "bg-brand-500 text-white";
            icon = <CheckIcon className="size-4" />;
          } else if (isCurrent) {
            circleClasses = "bg-brand-500 text-white";
            icon = <span className="block h-2 w-2 rounded-full bg-white" />;
          } else {
            circleClasses = "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500";
            icon = <span className="block h-2 w-2 rounded-full bg-current" />;
          }
          const lineComplete = steps[i + 1]?.complete;
          return (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {isCurrent && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/40" />}
                  <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${circleClasses}`}>
                    {icon}
                  </div>
                </div>
                <span className={`text-xs font-medium ${step.rejected ? "text-error-500" : step.complete || isCurrent ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-500"}`}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={`h-0.5 flex-1 mx-2 mb-6 rounded ${lineComplete ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 sm:w-44 shrink-0">{label}</span>
      <span className={`text-sm text-gray-800 dark:text-white/90 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function DetailsCard({ data }: { data: VerificationObj }) {
  return (
    <div className={CARD}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Application Details</h3>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <DetailRow label="Seller Name" value={data.sellerName} />
        <DetailRow label="Matric Number" value={data.matricNo} mono />
        <DetailRow label="Faculty" value={data.faculty} />
        <DetailRow label="Business Name" value={data.businessName} />
        {data.businessDescription && <DetailRow label="Business Description" value={data.businessDescription} />}
        <DetailRow label="Email" value={data.email} />
        <DetailRow label="Submitted Date" value={formatDate(data.submittedAt)} />
        {data.reviewedAt && <DetailRow label="Reviewed Date" value={formatDate(data.reviewedAt)} />}
      </div>
    </div>
  );
}

function StatusBanner({ data }: { data: VerificationObj }) {
  const s = data.status;
  if (s === "Pending") {
    return (
      <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <p className="text-sm font-medium text-warning-700 dark:text-warning-400">Your verification is being reviewed by our team.</p>
        </div>
      </div>
    );
  }
  if (s === "Under Review") {
    return (
      <div className="rounded-xl border border-brand-300 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">An admin is currently reviewing your application.</p>
        </div>
      </div>
    );
  }
  if (s === "Approved") {
    return (
      <div className="rounded-xl border border-success-300 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/10">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
            <ShieldCheckIcon className="size-3.5" />
          </span>
          <p className="text-sm font-medium text-success-700 dark:text-success-400">Congratulations! You&apos;re a verified UNILAG seller.</p>
        </div>
      </div>
    );
  }
  if (s === "Rejected") {
    return (
      <div className="rounded-xl border border-error-300 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/10">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-error-500 text-white">
            <XIcon className="size-3.5" />
          </span>
          <div>
            <p className="text-sm font-medium text-error-700 dark:text-error-400">Your verification was rejected.</p>
            {data.adminNotes && <p className="mt-1 text-sm text-error-600 dark:text-error-300">Admin notes: {data.adminNotes}</p>}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SellerVerificationPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("ref") === "welcome";
  const refListing = searchParams.get("ref") === "listing";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SellerVerificationData>(null);

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    sellerApi.getVerification(token).then((res) => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) return <Spinner />;

  if (data === null) {
    if (!token || !user) return <Spinner />;
    return (
      <VerificationSubmitForm
        token={token}
        userName={user.display_name || user.username}
        userEmail={user.email || ""}
        userId={user.id}
        isWelcome={isWelcome || refListing}
        onDone={() => {
          refresh();
          if (refListing) router.push("/seller/listings/new");
        }}
      />
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">Verification Status</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track the progress of your seller verification application.</p>
      </div>
      <ProgressTracker status={data.status} />
      <StatusBanner data={data} />
      <DetailsCard data={data} />
    </div>
  );
}
