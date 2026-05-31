"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { formatDateTimeWAT } from "@/utils/date";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminVerification } from "@/lib/api";
import { Store, CheckCircle, XCircle, Clock, FileText, MapPin, Tag, Mail, GraduationCap, Image as ImageIcon } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";

type Tab = "Pending" | "Approved" | "Rejected";
const TABS: Tab[] = ["Pending", "Approved", "Rejected"];

const TAB_COLORS: Record<Tab, string> = {
  Pending:  "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  Approved: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
};

// Shared WAT formatter — normalizes naive-UTC timestamps so times aren't an
// hour behind.
function wat(dateStr: string) {
  return formatDateTimeWAT(dateStr);
}

export default function AdminSellerVerificationsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("Pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<AdminVerification | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<AdminVerification | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchFn = useCallback(() => adminApi.getVerifications(token!, tab), [token, tab]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminVerification[] }>(
    fetchFn, 30_000, !!token
  );

  const verifications: AdminVerification[] = data?.data ?? [];

  const handleApprove = async () => {
    if (!approveTarget || !token) return;
    setActionLoading(true);
    try {
      await adminApi.approveVerification(token, approveTarget.id);
      refetch();
      setApproveTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed to approve", "error"); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectTarget || !token) return;
    setActionLoading(true);
    try {
      await adminApi.rejectVerification(token, rejectTarget.id, rejectReason || undefined);
      refetch();
      setRejectTarget(null);
      setRejectReason("");
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed to reject", "error"); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Store size={22} className="text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Seller Verifications</h1>
        <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">
          {verifications.length}
        </span>
      </div>

      <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1 w-fit">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => { setTab(t); setExpandedId(null); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && verifications.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] py-16 text-center">
          <Clock size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-base font-semibold text-gray-700 dark:text-white/80">No {tab.toLowerCase()} verifications</p>
        </div>
      )}

      <div className="space-y-3">
        {loading && verifications.length === 0 && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800/50 animate-pulse" />
          ))
        )}

        {verifications.map((v) => {
          const isOpen = expandedId === v.id;
          return (
            <div key={v.id} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : v.id)}
                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors flex items-center gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                  {(v.seller_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 dark:text-white/90">{v.seller_name}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TAB_COLORS[v.status as Tab] ?? TAB_COLORS.Pending}`}>
                      {v.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {v.matric_no} · {v.email} · {wat(v.submitted_at)}
                  </p>
                </div>
                <span className="text-xs text-brand-500 font-medium">
                  {isOpen ? "Hide details" : "View details"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-5 space-y-5 bg-gray-50/50 dark:bg-gray-900/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<FileText size={14} />} label="Matric Number" value={v.matric_no} mono />
                    <InfoRow icon={<GraduationCap size={14} />} label="Faculty / Department" value={v.faculty || "—"} />
                    <InfoRow icon={<Tag size={14} />} label="Business Category" value={v.business_category || "—"} />
                    <InfoRow icon={<Store size={14} />} label="Business Name" value={v.business_name || "—"} />
                    <InfoRow icon={<MapPin size={14} />} label="Pickup / Delivery Location" value={v.pickup_location || "—"} />
                    <InfoRow icon={<Mail size={14} />} label="Email" value={v.email} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DocPreview label="Student ID Card" url={v.document_url} />
                    <DocPreview label="Student Portal Screenshot" url={v.portal_screenshot_url} />
                  </div>

                  {v.admin_notes && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-3">
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Admin notes</p>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{v.admin_notes}</p>
                    </div>
                  )}

                  {v.status === "Pending" || v.status === "Under Review" ? (
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setApproveTarget(v)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-xs font-semibold text-white hover:bg-green-600 transition-colors">
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button type="button" onClick={() => { setRejectTarget(v); setRejectReason(""); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors">
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
        title="Approve Verification"
        description={`Approve verification for "${approveTarget?.seller_name}"? They will gain seller access immediately.`}
        confirmLabel="Approve"
        variant="primary"
        loading={actionLoading}
      />

      {rejectTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reject Verification</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Rejecting <span className="font-semibold text-gray-700 dark:text-gray-200">{rejectTarget.seller_name}</span>.
            </p>
            <textarea rows={3} placeholder="Rejection reason (optional)" value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-red-400 focus:outline-none resize-none" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setRejectTarget(null)} disabled={actionLoading}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleReject} disabled={actionLoading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 flex items-center gap-2">
                {actionLoading && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {icon} {label}
      </p>
      <p className={`mt-1 text-sm text-gray-800 dark:text-white/90 break-words ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function DocPreview({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
        <ImageIcon size={20} className="mx-auto text-gray-300 dark:text-gray-600" />
        <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-[11px] text-gray-400">Not uploaded</p>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="block rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 hover:border-brand-400 transition-colors">
      <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-800">
        <Image src={url} alt={label} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain" />
      </div>
      <div className="p-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-[11px] text-brand-500">Open full size →</span>
      </div>
    </a>
  );
}
