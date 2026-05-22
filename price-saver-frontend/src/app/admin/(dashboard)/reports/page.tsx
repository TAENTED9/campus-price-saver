"use client";

import React, { useState, useCallback } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminReport } from "@/lib/api";
import { ShieldAlert, CheckCircle, Eye, XCircle, RefreshCw, User, Tag, Clock } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

type TabFilter = "all" | "open" | "under_review" | "resolved" | "dismissed";

const TABS: { label: string; value: TabFilter }[] = [
  { label: "All",          value: "all" },
  { label: "Open",         value: "open" },
  { label: "Under Review", value: "under_review" },
  { label: "Resolved",     value: "resolved" },
  { label: "Dismissed",    value: "dismissed" },
];

// Backend stores capitalized statuses; the UI filter values are lowercase keys.
const STATUS_KEY: Record<string, TabFilter> = {
  "Open":         "open",
  "Under Review": "under_review",
  "Resolved":     "resolved",
  "Dismissed":    "dismissed",
};

function parseServerDate(dateStr: string): Date {
  // Backend sends naive UTC ISO strings (no "Z"). Force-treat as UTC.
  const s = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  return new Date(s);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - parseServerDate(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function wat(dateStr: string) {
  return parseServerDate(dateStr).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type ModalState = { report: AdminReport; mode: "resolve" | "dismiss" } | null;

export default function ReportsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useToast();
  const [tab, setTab]               = useState<TabFilter>("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [modal, setModal]           = useState<ModalState>(null);
  const [noteText, setNoteText]     = useState("");

  const fetchData = useCallback(() => adminApi.getReports(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminReport[] }>(
    fetchData, 30_000, !!token
  );

  const allReports  = data?.data ?? [];
  const openCount   = allReports.filter((r) => STATUS_KEY[r.status] === "open").length;
  const filtered    = tab === "all" ? allReports : allReports.filter((r) => STATUS_KEY[r.status] === tab);

  const handleReview = async (r: AdminReport) => {
    if (!token) return;
    setActionLoading(r.id);
    try { await adminApi.reviewReport(token, r.id); refetch(); }
    catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  const handleModalSubmit = async () => {
    if (!modal || !token) return;
    setActionLoading(modal.report.id);
    try {
      if (modal.mode === "resolve")  await adminApi.resolveReport(token, modal.report.id, noteText || undefined);
      else                           await adminApi.dismissReport(token, modal.report.id, noteText || undefined);
      showToast(modal.mode === "resolve" ? "Report resolved" : "Report dismissed", "success");
      refetch();
      setModal(null);
      setNoteText("");
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert size={22} className="text-red-500" />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Reports</h1>
          {openCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </div>
        <button type="button" onClick={() => refetch()} title="Refresh"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1 w-fit flex-wrap">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}>
            {t.label}
            {t.value === "open" && openCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] py-16 text-center">
          <ShieldAlert size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-semibold text-gray-700 dark:text-white/80">No {tab === "all" ? "" : tab.replace("_", " ")} reports</p>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 space-y-3">
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="flex gap-2 mt-4">
                  <div className="h-7 w-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="h-7 w-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ))
          : filtered.map((r) => (
              <div key={r.id}
                className="flex flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 dark:text-white/90 truncate">
                      {r.target_name || `#${r.target_id}`}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-500 mt-1">
                      <Tag size={10} /> {r.target_type}
                    </span>
                  </div>
                  <StatusBadge status={r.status} className="shrink-0" />
                </div>

                {/* Reason */}
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{r.reason}</p>

                {/* Admin notes */}
                {r.admin_notes && (
                  <p className="text-xs text-gray-400 italic border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                    {r.admin_notes}
                  </p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><User size={10} /> {r.reporter_name}</span>
                  <span className="flex items-center gap-1" title={wat(r.created_at)}>
                    <Clock size={10} /> {timeAgo(r.created_at)} · {wat(r.created_at)} WAT
                  </span>
                </div>

                {/* Actions */}
                {r.status !== "Resolved" && r.status !== "Dismissed" && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-800 mt-auto">
                    {r.status === "Open" && (
                      <button type="button" onClick={() => handleReview(r)} disabled={actionLoading === r.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        <Eye size={12} /> Mark Under Review
                      </button>
                    )}
                    <button type="button" onClick={() => { setNoteText(""); setModal({ report: r, mode: "resolve" }); }}
                      disabled={actionLoading === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-100 disabled:opacity-50 transition-colors">
                      <CheckCircle size={12} /> Resolve
                    </button>
                    <button type="button" onClick={() => { setNoteText(""); setModal({ report: r, mode: "dismiss" }); }}
                      disabled={actionLoading === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-700/30 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-50 transition-colors">
                      <XCircle size={12} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
      </div>

      {/* Resolve / Dismiss modal */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white capitalize">
              {modal.mode} Report
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Target: <span className="font-medium text-gray-700 dark:text-gray-200">{modal.report.target_name || `#${modal.report.target_id}`}</span>
            </p>
            <textarea
              rows={3}
              placeholder={modal.mode === "resolve" ? "Admin notes (optional)" : "Dismissal reason (optional)"}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setModal(null)} disabled={actionLoading === modal.report.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleModalSubmit} disabled={actionLoading === modal.report.id}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 flex items-center gap-2 ${
                  modal.mode === "resolve" ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-600"
                }`}>
                {actionLoading === modal.report.id && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                {modal.mode === "resolve" ? "Resolve" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
