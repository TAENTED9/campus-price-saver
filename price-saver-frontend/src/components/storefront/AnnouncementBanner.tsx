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

const DISMISS_KEY = "campify_announcement_dismissed";

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<ActiveAnnouncement | null>(null);
  const [visible, setVisible]           = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/announcements/active`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const ann: ActiveAnnouncement = Array.isArray(data) ? data[0] : data;
        if (!ann) return;
        if (dismissed === String(ann.id)) return;
        setAnnouncement(ann);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    if (announcement) localStorage.setItem(DISMISS_KEY, String(announcement.id));
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
