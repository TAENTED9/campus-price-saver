"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { storefrontApi, type BuyerInquiry, type ThreadMessage } from "@/lib/api";
import { MessageCircle, ChevronDown, ChevronUp, Send } from "lucide-react";

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
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {letters.toUpperCase()}
    </div>
  );
}

function ThreadBubble({ msg, sellerName }: { msg: ThreadMessage; sellerName: string }) {
  const isBuyer = msg.sender === "buyer";
  return (
    <div className={`flex gap-2 ${isBuyer ? "flex-row-reverse" : ""}`}>
      {isBuyer
        ? <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">You</div>
        : <Initials name={sellerName} />
      }
      <div className="flex-1 max-w-[80%]">
        <div className={`rounded-xl px-4 py-3 text-sm ${
          isBuyer
            ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 rounded-tr-none"
            : "bg-gray-50 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 rounded-tl-none"
        }`}>
          {msg.text}
        </div>
        <p className={`text-[11px] text-gray-400 mt-1 ${isBuyer ? "text-right mr-1" : "ml-1"}`}>
          {timeAgo(msg.at)}
        </p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<BuyerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [followUpText, setFollowUpText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const bottomRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const fetchInquiries = useCallback(() => {
    if (!token) return;
    storefrontApi.getMyInquiries(token)
      .then(res => { if (res.success) setInquiries(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Initial load + 15s poll to catch new seller replies
  useEffect(() => {
    fetchInquiries();
    const interval = setInterval(fetchInquiries, 15000);
    return () => clearInterval(interval);
  }, [fetchInquiries]);

  // Refresh immediately when tab becomes visible
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchInquiries(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchInquiries]);

  // Scroll to bottom of thread when expanded
  useEffect(() => {
    if (expanded !== null) {
      setTimeout(() => bottomRefs.current[expanded]?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [expanded]);

  async function sendFollowUp(inq: BuyerInquiry) {
    const text = (followUpText[inq.id] || "").trim();
    if (!text || !token) return;
    setSending(inq.id);
    try {
      const res = await storefrontApi.sendFollowUp(token, inq.id, text);
      if (res.success) {
        setInquiries(prev => prev.map(i =>
          i.id === inq.id ? { ...i, thread: res.thread } : i
        ));
        setFollowUpText(prev => ({ ...prev, [inq.id]: "" }));
        setTimeout(() => bottomRefs.current[inq.id]?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch { /* silent */ }
    finally { setSending(null); }
  }

  function buildThread(inq: BuyerInquiry): ThreadMessage[] {
    if (inq.thread && inq.thread.length > 0) return inq.thread;
    // Fallback for old inquiries without thread data
    const msgs: ThreadMessage[] = [{ sender: "buyer", text: inq.message, at: inq.created_at }];
    if (inq.seller_reply) msgs.push({ sender: "seller", text: inq.seller_reply, at: inq.replied_at ?? inq.created_at });
    return msgs;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Messages</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {inquiries.length > 0
            ? `${inquiries.filter(i => i.seller_reply).length} replied · ${inquiries.length} total`
            : "Your conversations with sellers"}
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
                <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && inquiries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <MessageCircle size={28} className="text-gray-400" />
          </div>
          <p className="font-bold text-gray-800 dark:text-white mb-1">No messages yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
            Start a conversation with a seller from any product listing.
          </p>
          <Link href="/search" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
            Browse Listings
          </Link>
        </div>
      )}

      {!loading && inquiries.length > 0 && (
        <div className="space-y-2">
          {inquiries.map(inq => {
            const isOpen = expanded === inq.id;
            const thread = buildThread(inq);
            const lastMsg = thread[thread.length - 1];
            return (
              <div key={inq.id}
                className={`rounded-2xl border bg-white dark:bg-white/[0.03] overflow-hidden transition-colors ${
                  inq.seller_reply ? "border-green-200 dark:border-green-500/20" : "border-gray-200 dark:border-gray-800"
                }`}>

                {/* Header */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : inq.id)}
                  className="w-full p-4 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <Initials name={inq.seller_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-gray-800 dark:text-white">{inq.seller_name}</span>
                      {inq.seller_reply && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
                          Replied
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{timeAgo(lastMsg?.at ?? inq.created_at)}</span>
                      {isOpen ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-brand-500 font-medium mb-0.5">re: {inq.listing_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{lastMsg?.text ?? inq.message}</p>
                  </div>
                </button>

                {/* Thread */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="mt-3 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                      {thread.map((msg, idx) => (
                        <ThreadBubble key={idx} msg={msg} sellerName={inq.seller_name} />
                      ))}
                      <div ref={el => { bottomRefs.current[inq.id] = el; }} />
                    </div>

                    {/* Follow-up input */}
                    <div className="mt-4 flex gap-2 items-end">
                      <textarea
                        rows={2}
                        value={followUpText[inq.id] || ""}
                        onChange={e => setFollowUpText(prev => ({ ...prev, [inq.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFollowUp(inq); } }}
                        placeholder="Send a follow-up…"
                        className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => sendFollowUp(inq)}
                        disabled={sending === inq.id || !(followUpText[inq.id] || "").trim()}
                        className="h-[60px] w-11 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 flex items-center justify-center text-white transition-colors flex-shrink-0"
                      >
                        {sending === inq.id
                          ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Send size={16} />
                        }
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Enter to send · Shift+Enter for new line</p>

                    <div className="mt-3 text-right">
                      <Link href={`/listing/${inq.listing_id}`} className="text-xs text-brand-500 font-semibold hover:underline">
                        View listing →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
