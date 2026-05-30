"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Megaphone, ArrowRight } from "lucide-react";
import { optimizeImage } from "@/lib/cloudinary";

interface Announcement {
  id: number;
  title: string;
  description?: string | null;
  message?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  created_at?: string;
}

export default function HomepageAnnouncements() {
  const [items,   setItems]   = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use the public endpoint — the bare /admin/announcements path requires
    // an admin token and returns 403 to unauthenticated storefront visitors.
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/announcements/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: Announcement[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.announcements)
          ? data.announcements
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setItems(list.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-base md:text-lg font-bold text-gray-900 dark:text-white">
            <Megaphone size={18} className="text-blue-500" />
            Campus Notices
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-pulse">
                <div className="h-36 bg-gray-100 dark:bg-gray-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
                  <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((ann) => {
              const img  = ann.image_url ? optimizeImage(ann.image_url, 600) : null;
              const body = ann.description ?? ann.message ?? "";
              return (
                <div
                  key={ann.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {img ? (
                    <div className="relative h-36 w-full">
                      <Image src={img} alt={ann.title} fill className="object-cover" sizes="(max-width:640px)100vw,33vw" />
                    </div>
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                      <Megaphone size={32} className="text-white/60" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">
                      {ann.title}
                    </h3>
                    {body && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                        {body}
                      </p>
                    )}
                    {ann.cta_href && ann.cta_label && (
                      <Link
                        href={ann.cta_href}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {ann.cta_label} <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
