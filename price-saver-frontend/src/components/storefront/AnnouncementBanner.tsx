"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Megaphone, X, ArrowRight } from "lucide-react";

interface ActiveAnnouncement {
  id: number;
  title: string;
  message?: string;
  description?: string;
  cta_label?: string | null;
  cta_href?: string | null;
}

/**
 * Block 2: dismissal state is stored in a cookie (`campify_announcement_dismissed`)
 * with a 30-day expiry, not localStorage. The cookie value is just the
 * announcement id — non-sensitive, fine to live in a cookie.
 */
const DISMISS_COOKIE = "campify_announcement_dismissed";

function readDismissedId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${DISMISS_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeDismissedId(id: number) {
  if (typeof document === "undefined") return;
  // 30 days, root path, lax — non-HttpOnly so this component can read it back.
  document.cookie = `${DISMISS_COOKIE}=${encodeURIComponent(String(id))};path=/;max-age=2592000;SameSite=Lax`;
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<ActiveAnnouncement | null>(null);
  const [visible, setVisible]           = useState(false);

  useEffect(() => {
    const dismissed = readDismissedId();
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/announcements/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        // Backend shape: { announcements: [...] }. Tolerate legacy shapes too.
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.announcements)
            ? data.announcements
            : data
              ? [data]
              : [];
        const ann: ActiveAnnouncement | undefined = list[0];
        if (!ann) return;
        if (dismissed === String(ann.id)) return;
        setAnnouncement(ann);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    if (announcement) writeDismissedId(announcement.id);
    setVisible(false);
  };

  if (!visible || !announcement) return null;

  const body = announcement.description ?? announcement.message ?? "";
  const ctaHref  = announcement.cta_href;
  const ctaLabel = announcement.cta_label;

  return (
    <div className="w-full bg-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0 py-2.5 flex items-center gap-3">
        <Megaphone size={16} className="shrink-0 opacity-80" />
        <p className="flex-1 text-sm font-medium truncate">
          <span className="font-bold mr-1">{announcement.title}</span>
          {body && <span className="opacity-90">{body}</span>}
        </p>
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="hidden sm:flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors shrink-0"
          >
            {ctaLabel} <ArrowRight size={11} />
          </Link>
        )}
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={dismiss}
          className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
