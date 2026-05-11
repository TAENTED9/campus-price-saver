"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, type Inquiry, type ThreadMessage } from "@/lib/api";
import { MessageCircle, Circle, Send, ChevronDown, ChevronUp, ArrowLeft, ChevronRight, Tag, Flag, Ban, Zap } from "lucide-react";

function timeAgo(iso: string) {
  const utc = iso && !iso.endsWith("Z") && !iso.includes("+") ? iso + "Z" : iso;
  const diff = Date.now() - new Date(utc).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {letters.toUpperCase()}
    </div>
  );
}

function ThreadBubble({ msg, buyerName }: { msg: ThreadMessage; buyerName: string }) {
  const isSeller = msg.sender === "seller";
  return (
    <div className={`flex gap-2 ${isSeller ? "flex-row-reverse" : ""}`}>
      {isSeller
        ? <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">You</div>
        : <Initials name={buyerName} />
      }
      <div className="flex-1 max-w-[80%]">
        <div className={`rounded-xl px-4 py-3 text-sm ${
          isSeller
            ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 rounded-tr-none"
            : "bg-gray-50 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 rounded-tl-none"
        }`}>
          {msg.text}
        </div>
        <p className={`text-[11px] text-gray-400 mt-1 ${isSeller ? "text-right mr-1" : "ml-1"}`}>
          {timeAgo(msg.at)}
        </p>
      </div>
    </div>
  );
}

const QUICK_TEMPLATES = [
  "Yes, it’s still available!",
  "Sorry, this item has been sold.",
  "You can pick it up at [location].",
  "The price is firm.",
  "I can negotiate, what’s your offer?",
  "I’ll get back to you shortly.",
];

const LABELS: { key: string; color: string; bg: string }[] = [
  { key: "Hot Lead",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30" },
  { key: "Pending",   color: "text-warning-700 dark:text-warning-400", bg: "bg-warning-50 dark:bg-warning-500/10 border-warning-200 dark:border-warning-500/30" },
  { key: "Completed", color: "text-success-700 dark:text-success-400", bg: "bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/30" },
  { key: "Spam",      color: "text-gray-500 dark:text-gray-400",       bg: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-800" },
];

type Toast = { message: string; type: "success" | "error" } | null;

export default function SellerInboxPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const replyRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const bottomRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [labelOpen, setLabelOpen] = useState<number | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [blockConfirm, setBlockConfirm] = useState<Inquiry | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [reportTarget, setReportTarget] = useState<Inquiry | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Derived: labels hydrated from server
  const labels: Record<number, string> = Object.fromEntries(
    inquiries.filter((i) => i.label).map((i) => [i.id, i.label as string])
  );

  const fetchInquiries = useCallback(() => {
    if (!token) return;
    sellerApi.getInquiries(token)
      .then((res) => { if (res.success) { setInquiries(res.data); setUnread(res.unread_count); } })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchInquiries();
    setLoading(false);
    const interval = setInterval(fetchInquiries, 15000);
    return () => clearInterval(interval);
  }, [fetchInquiries, token]);

  // Refresh immediately when tab becomes visible
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchInquiries(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchInquiries]);

  // Scroll to bottom when expanded
  useEffect(() => {
    if (expanded !== null) {
      setTimeout(() => bottomRefs.current[expanded]?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [expanded]);

  async function handleExpand(inq: Inquiry) {
    if (expanded === inq.id) { setExpanded(null); return; }
    setExpanded(inq.id);
    if (!inq.is_read && token) {
      try {
        await sellerApi.markInquiryRead(token, inq.id);
        setInquiries((prev) => prev.map((i) => i.id === inq.id ? { ...i, is_read: true } : i));
        setUnread((n) => Math.max(0, n - 1));
      } catch { /* silent */ }
    }
    setTimeout(() => replyRefs.current[inq.id]?.focus(), 150);
  }

  async function sendReply(inq: Inquiry) {
    const text = (replyText[inq.id] || "").trim();
    if (!text || !token) return;
    setSending(inq.id);
    try {
      const res = await sellerApi.replyToInquiry(token, inq.id, text);
      if (res.success) {
        fetchInquiries();
        setReplyText((prev) => ({ ...prev, [inq.id]: "" }));
        setTimeout(() => bottomRefs.current[inq.id]?.scrollIntoView({ behavior: "smooth" }), 200);
        showToast("Reply sent", "success");
      } else {
        showToast("Failed to send reply", "error");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to send reply", "error");
    }
    finally { setSending(null); }
  }

  async function confirmBlock() {
    if (!blockConfirm || !token) return;
    setBlocking(true);
    try {
      await sellerApi.blockUser(token, blockConfirm.buyer_id);
      showToast(`${blockConfirm.buyer_name} has been blocked.`, "success");
      setBlockConfirm(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to block user", "error");
    } finally {
      setBlocking(false);
    }
  }

  async function submitReport() {
    if (!reportTarget || !token) return;
    const reason = reportReason.trim();
    if (!reason) { showToast("Please describe the issue", "error"); return; }
    if (!reportTarget.buyer_uuid) { showToast("Cannot report this user", "error"); return; }
    setReportSubmitting(true);
    try {
      await sellerApi.reportUser(token, reportTarget.buyer_uuid, reason);
      showToast("Report submitted. We'll review within 24 hours.", "success");
      setReportTarget(null);
      setReportReason("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to submit report", "error");
    } finally {
      setReportSubmitting(false);
    }
  }

  function buildThread(inq: Inquiry): ThreadMessage[] {
    if (inq.thread && inq.thread.length > 0) return inq.thread;
    // Fallback for old inquiries without thread data
    const msgs: ThreadMessage[] = [{ sender: "buyer", text: inq.message, at: inq.created_at }];
    if (inq.seller_reply) msgs.push({ sender: "seller", text: inq.seller_reply, at: inq.replied_at ?? inq.created_at });
    return msgs;
  }

  const activeInq = expanded !== null ? inquiries.find((i) => i.id === expanded) ?? null : null;

  function openInquiry(inq: Inquiry) {
    handleExpand(inq);
    setMobileView("thread");
  }

  function applyTemplate(inqId: number, tpl: string) {
    setReplyText((prev) => ({ ...prev, [inqId]: (prev[inqId] ?? "") + tpl + " " }));
    setTemplatesOpen(false);
    setTimeout(() => replyRefs.current[inqId]?.focus(), 50);
  }

  async function setLabel(inqId: number, label: string) {
    if (!token) return;
    const current = inquiries.find((i) => i.id === inqId)?.label ?? null;
    const next = current === label ? null : label;
    setLabelOpen(null);
    // Optimistic update
    setInquiries((prev) => prev.map((i) => i.id === inqId ? { ...i, label: next } : i));
    try {
      await sellerApi.setInquiryLabel(token, inqId, next);
    } catch {
      // Revert on failure
      fetchInquiries();
      showToast("Failed to update label", "error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Inbox</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {unread > 0 ? `${unread} unread message${unread > 1 ? "s" : ""}` : "Messages from potential buyers"}
          </p>
        </div>
      </div>

      {/* Two-panel container */}
      <div className="flex overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] h-[560px] md:h-[700px]">

        {/* ── Left panel: conversation list ── */}
        <div className={`${
          mobileView === "thread" ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-72 xl:w-80 border-r border-gray-200 dark:border-gray-800 flex-shrink-0`}>

          {/* List header */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Conversations {inquiries.length > 0 && `(${inquiries.length})`}
            </p>
          </div>

          {/* Skeleton */}
          {loading && (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2 p-2 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
                    <div className="h-2.5 w-3/4 rounded bg-gray-100 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && inquiries.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center">
              <MessageCircle size={28} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No messages yet</p>
            </div>
          )}

          {/* Conversation rows */}
          {!loading && (
            <div className="overflow-y-auto flex-1 scrollbar-hide">
              {inquiries.map((inq) => {
                const thread = buildThread(inq);
                const lastMsg = thread[thread.length - 1];
                const isActive = expanded === inq.id;
                const inqLabel = labels[inq.id];
                const labelMeta = LABELS.find((l) => l.key === inqLabel);
                return (
                  <button key={inq.id} type="button" onClick={() => openInquiry(inq)}
                    className={`w-full p-3 flex items-start gap-2.5 text-left border-b border-gray-50 dark:border-gray-800/60 transition-colors ${
                      isActive ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    }`}>
                    <Initials name={inq.buyer_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-[13px] text-gray-800 dark:text-white truncate">{inq.buyer_name}</span>
                        {!inq.is_read && <Circle size={7} className="text-brand-500 fill-brand-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-brand-500 font-medium truncate mb-0.5">re: {inq.listing_name}</p>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{lastMsg?.text ?? inq.message}</p>
                      {labelMeta && (
                        <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${labelMeta.bg} ${labelMeta.color}`}>
                          {inqLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-gray-400">{timeAgo(lastMsg?.at ?? inq.created_at)}</span>
                      <ChevronRight size={12} className="text-gray-300 dark:text-gray-600" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right panel: thread ── */}
        <div className={
          mobileView === "list"
            ? "hidden md:flex md:flex-1 md:flex-col"
            : "fixed inset-0 pt-[64px] pb-[70px] z-[25] flex flex-col bg-white dark:bg-gray-900 md:static md:inset-auto md:pt-0 md:pb-0 md:z-auto md:flex-1 md:flex-col md:bg-transparent"
        }>

          {!activeInq ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
              <MessageCircle size={40} className="text-gray-200 dark:text-gray-700 mb-4" />
              <p className="font-semibold text-gray-400 dark:text-gray-500">Select a conversation</p>
              <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">Choose a message from the left panel</p>
            </div>
          ) : (() => {
            const inq = activeInq;
            const thread = buildThread(inq);
            const inqLabel = labels[inq.id];
            const labelMeta = LABELS.find((l) => l.key === inqLabel);
            return (
              <div className="flex flex-col flex-1 overflow-hidden">

                {/* Thread header */}
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
                  {/* Mobile back */}
                  <button type="button" aria-label="Back to list" onClick={() => setMobileView("list")}
                    className="md:hidden text-gray-500 hover:text-gray-800 dark:text-gray-400">
                    <ArrowLeft size={18} />
                  </button>
                  <Initials name={inq.buyer_name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 dark:text-white">{inq.buyer_name}</p>
                    <p className="text-xs text-brand-500 font-medium truncate">re: {inq.listing_name}</p>
                  </div>

                  {/* Label chip */}
                  {labelMeta && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${labelMeta.bg} ${labelMeta.color}`}>
                      {inqLabel}
                    </span>
                  )}

                  {/* Label picker */}
                  <div className="relative">
                    <button type="button" aria-label="Set label" onClick={() => setLabelOpen(labelOpen === inq.id ? null : inq.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                      <Tag size={14} />
                    </button>
                    {labelOpen === inq.id && (
                      <div className="absolute right-0 top-9 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-30 overflow-hidden">
                        {LABELS.map((l) => (
                          <button key={l.key} type="button" onClick={() => setLabel(inq.id, l.key)}
                            className={`w-full px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 ${
                              labels[inq.id] === l.key ? "bg-gray-50 dark:bg-gray-800" : ""
                            } ${l.color}`}>
                            {l.key}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Report */}
                  <button type="button" aria-label="Report buyer" title="Report buyer"
                    onClick={() => setReportTarget(inq)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-500/10 transition-colors">
                    <Flag size={14} />
                  </button>

                  {/* Block */}
                  <button type="button" aria-label="Block buyer" title="Block buyer"
                    onClick={() => setBlockConfirm(inq)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors">
                    <Ban size={14} />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 scrollbar-hide">
                  {thread.map((msg, idx) => (
                    <ThreadBubble key={idx} msg={msg} buyerName={inq.buyer_name} />
                  ))}
                  <div ref={el => { bottomRefs.current[inq.id] = el; }} />
                </div>

                {/* Reply box */}
                <div className="p-3 flex-shrink-0">
                  {/* Quick templates */}
                  <div className="relative mb-2">
                    <button type="button" onClick={() => setTemplatesOpen(!templatesOpen)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors">
                      <Zap size={11} /> Quick replies <ChevronDown size={11} className={templatesOpen ? "rotate-180" : ""} />
                    </button>
                    {templatesOpen && (
                      <div className="absolute bottom-8 left-0 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-30 overflow-hidden">
                        {QUICK_TEMPLATES.map((tpl) => (
                          <button key={tpl} type="button" onClick={() => applyTemplate(inq.id, tpl)}
                            className="w-full px-4 py-2.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                            {tpl}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={(el) => { replyRefs.current[inq.id] = el; }}
                      rows={2}
                      value={replyText[inq.id] || ""}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(inq); }
                      }}
                      placeholder="Type a reply…"
                      className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 resize-none scrollbar-hide"
                    />
                    <button type="button" aria-label="Send reply"
                      onClick={() => sendReply(inq)}
                      disabled={sending === inq.id || !(replyText[inq.id] || "").trim()}
                      className="h-[60px] w-11 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 flex items-center justify-center text-white transition-colors flex-shrink-0">
                      {sending === inq.id
                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Block confirm modal */}
      {blockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !blocking && setBlockConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-error-50 dark:bg-error-500/10 flex items-center justify-center mx-auto mb-4">
              <Ban size={24} className="text-error-500" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-1">Block {blockConfirm.buyer_name}?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">They will no longer be able to message you or see your listings.</p>
            <div className="flex gap-2">
              <button type="button" disabled={blocking} onClick={() => setBlockConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-400 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={blocking} onClick={confirmBlock}
                className="flex-1 py-2.5 rounded-xl bg-error-500 text-white text-sm font-bold hover:bg-error-600 transition-colors disabled:opacity-60">
                {blocking ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !reportSubmitting && setReportTarget(null)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center flex-shrink-0">
                <Flag size={18} className="text-warning-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 dark:text-white">Report {reportTarget.buyer_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  re: {reportTarget.listing_name}
                </p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Reason
            </label>
            <textarea
              rows={4}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe what happened (harassment, spam, scam, etc.)"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 resize-none"
              maxLength={500}
              disabled={reportSubmitting}
            />
            <p className="text-[11px] text-gray-400 mt-1">{reportReason.length}/500</p>

            <div className="flex gap-2 mt-5">
              <button type="button" disabled={reportSubmitting} onClick={() => { setReportTarget(null); setReportReason(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-400 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={reportSubmitting || !reportReason.trim()} onClick={submitReport}
                className="flex-1 py-2.5 rounded-xl bg-warning-500 text-white text-sm font-bold hover:bg-warning-600 transition-colors disabled:opacity-50">
                {reportSubmitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-xl border max-w-sm text-sm font-medium ${
          toast.type === "success"
            ? "bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/30 text-success-700 dark:text-success-400"
            : "bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/30 text-error-700 dark:text-error-400"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
