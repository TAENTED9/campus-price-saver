/**
 * Seller dashboard banner: shown when one or more of the seller's listings
 * has `needs_location_update === true` — i.e. the startup migration
 * auto-blocked it because its old location was "Angola"/"Freedom Park"/etc.
 *
 * Stateless. Parent computes the affected count from the seller's listings
 * array and decides whether to render this component at all.
 */
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface LocationsNeededBannerProps {
  affectedCount: number;
  /** Optional href for the "Update locations" CTA. */
  updateHref?: string;
  className?: string;
}

export function LocationsNeededBanner({
  affectedCount,
  updateHref = "/seller/listings?filter=needs_update",
  className = "",
}: LocationsNeededBannerProps) {
  if (affectedCount <= 0) return null;

  return (
    <div
      className={`rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            {affectedCount === 1
              ? "1 listing needs delivery locations"
              : `${affectedCount} listings need delivery locations`}
          </h3>
          <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            We&apos;ve updated UNILAG&apos;s pickup locations. The affected listings
            are hidden from buyers until you set a primary spot and pick from
            the new canonical list.
          </p>
        </div>
        <Link
          href={updateHref}
          className="flex-shrink-0 inline-flex items-center px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
        >
          Update locations →
        </Link>
      </div>
    </div>
  );
}

export default LocationsNeededBanner;
