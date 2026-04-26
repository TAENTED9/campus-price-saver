"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, type SellerVerificationData } from "@/lib/api";
import { VerificationSubmitForm } from "@/components/seller/VerificationForm";

type VerificationObj = Exclude<SellerVerificationData, null>;

const CARD =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6";

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
      {data.status === "Rejected" && token && user && (
        <VerificationSubmitForm
          token={token}
          userName={user.display_name || user.username}
          userEmail={user.email || ""}
          userId={user.id}
          isWelcome={false}
          isResubmission
          onDone={refresh}
        />
      )}
    </div>
  );
}
