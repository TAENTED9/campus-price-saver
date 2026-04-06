"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { Bell, X, Check, Megaphone, ShoppingBag, MessageCircle, Star, AlertCircle, BadgeCheck, BadgeX } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { notificationsApi, type AppNotification } from "@/lib/api";
import { useRouter as _useRouter } from "next/navigation";

function timeAgo(iso: string) {
  // Treat naive ISO strings (no Z / offset) as UTC
  const utc = iso && !iso.endsWith("Z") && !iso.includes("+") ? iso + "Z" : iso;
  const diff = Date.now() - new Date(utc).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  const base = "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0";
  if (type === "new_message")           return <div className={`${base} bg-blue-100 text-blue-600`}><MessageCircle size={16} /></div>;
  if (type === "price_drop")            return <div className={`${base} bg-green-100 text-green-600`}><ShoppingBag size={16} /></div>;
  if (type === "restock")               return <div className={`${base} bg-cyan-100 text-cyan-600`}><ShoppingBag size={16} /></div>;
  if (type === "new_listing")           return <div className={`${base} bg-purple-100 text-purple-600`}><Megaphone size={16} /></div>;
  if (type === "review")                return <div className={`${base} bg-yellow-100 text-yellow-600`}><Star size={16} /></div>;
  if (type === "sale")                  return <div className={`${base} bg-brand-100 text-brand-600`}><AlertCircle size={16} /></div>;
  if (type === "verification_approved") return <div className={`${base} bg-green-100 text-green-600`}><BadgeCheck size={16} /></div>;
  if (type === "verification_rejected") return <div className={`${base} bg-red-100 text-red-500`}><BadgeX size={16} /></div>;
  return <div className={`${base} bg-gray-100 text-gray-500`}><Bell size={16} /></div>;
}

export default function NotificationDropdown({ scope }: { scope?: string }) {
  const { token } = useAuth();
  const router    = _useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await notificationsApi.list(token, 0, 30, scope);
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token, scope]);

  useEffect(() => {
    if (!token) return;
    notificationsApi.unreadCount(token, scope).then((r) => setUnreadCount(r.unread_count)).catch(() => {});
    const interval = setInterval(() => {
      notificationsApi.unreadCount(token, scope).then((r) => setUnreadCount(r.unread_count)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [token, scope]);

  async function handleOpen() {
    if (!isOpen) await fetchNotifications();
    setIsOpen(!isOpen);
  }

  async function markAllRead() {
    if (!token) return;
    await notificationsApi.markAllRead(token).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function markOneRead(n: AppNotification) {
    if (!token || n.is_read) return;
    await notificationsApi.markRead(token, n.id).catch(() => {});
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  if (!token) return null;

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleOpen}
      >
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        <Bell size={20} />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute -right-[240px] mt-[17px] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark w-[350px] sm:w-[380px] lg:right-0 z-50"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-xs text-white bg-brand-500 px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h5>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 font-medium">
                <Check size={12} /> Mark all read
              </button>
            )}
            <button type="button" aria-label="Close notifications" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        <ul className="flex flex-col max-h-[400px] overflow-y-auto">
          {loading && (
            <li className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading…</li>
          )}
          {!loading && notifications.length === 0 && (
            <li className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Bell size={32} className="mb-2 opacity-30" />
              <span className="text-sm">No notifications yet</span>
            </li>
          )}
          {!loading && notifications.map((n) => {
            const isApproved = n.type === "verification_approved";
            const isRejected = n.type === "verification_rejected";
            const accentBorder = isApproved
              ? "border-l-4 border-l-green-400"
              : isRejected
              ? "border-l-4 border-l-red-400"
              : "";
            // action_url comes from the API notification object
            const actionUrl = (n as AppNotification & { action_url?: string }).action_url;

            return (
              <li key={n.id}>
                <button
                  type="button"
                  aria-label={n.title}
                  onClick={() => {
                    markOneRead(n);
                    if (actionUrl) router.push(actionUrl);
                  }}
                  className={`w-full flex gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left ${accentBorder} ${!n.is_read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                >
                  <NotifIcon type={n.type} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium truncate ${!n.is_read ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
                      {n.title}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</span>
                    <span className="block text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <Link
            href="/notifications"
            className="block text-center text-sm font-medium text-brand-500 hover:text-brand-700"
            onClick={() => setIsOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </Dropdown>
    </div>
  );
}
