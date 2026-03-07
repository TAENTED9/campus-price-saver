"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, type Inquiry } from "@/lib/api";
import { MessageCircle, Circle } from "lucide-react";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
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
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
      {letters.toUpperCase()}
    </div>
  );
}

export default function SellerInboxPage() {
  const { token } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    sellerApi.getInquiries(token)
      .then((res) => { if (res.success) { setInquiries(res.data); setUnread(res.unread_count); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

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
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Inbox</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {unread > 0 ? `${unread} unread message${unread > 1 ? "s" : ""}` : "Messages from potential buyers"}
        </p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            When buyers message you about your listings, they appear here.
          </p>
        </div>
      )}

      {!loading && inquiries.length > 0 && (
        <div className="space-y-2">
          {inquiries.map((inq) => (
            <div key={inq.id} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleExpand(inq)}
              onClick={() => handleExpand(inq)}
              className={`rounded-2xl border bg-white dark:bg-white/[0.03] overflow-hidden cursor-pointer transition-colors ${
                !inq.is_read ? "border-brand-200 dark:border-brand-500/30" : "border-gray-200 dark:border-gray-800"
              }`}>
              <div className="p-4 flex items-start gap-3">
                <Initials name={inq.buyer_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-800 dark:text-white">{inq.buyer_name}</span>
                    {!inq.is_read && <Circle size={8} className="text-brand-500 fill-brand-500 flex-shrink-0" />}
                    <span className="text-xs text-gray-400 ml-auto">{timeAgo(inq.created_at)}</span>
                  </div>
                  <p className="text-xs text-brand-500 font-medium mb-0.5">re: {inq.listing_name}</p>
                  <p className={`text-sm text-gray-600 dark:text-gray-400 ${expanded === inq.id ? "" : "truncate"}`}>
                    {inq.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
