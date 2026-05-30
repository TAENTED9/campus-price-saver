/**
 * Buyer-side display for a listing's pickup locations.
 *
 * Renders two things, in order:
 *  1. The seller's primary spot (free text) — prominent, with a "primary"
 *     badge. This is what the seller typed; the field they're required to
 *     fill before publishing.
 *  2. The canonical picks — grouped by parent zone, rendered as chips so
 *     buyers can scan quickly.
 *
 * Both sections are optional: if `primaryLocation` is empty the primary
 * card is skipped; if `locations` is empty the grouped chips are skipped.
 * If BOTH are empty the component renders nothing (legacy migrated rows).
 */
"use client";

import { MapPin } from "lucide-react";
import { groupSelectedLocations, useLocations } from "@/lib/locations";

interface LocationDisplayProps {
  primaryLocation?: string | null;
  locations?: string[] | null;
  /** Render compact (single line per group) — used in tight cards. */
  compact?: boolean;
  className?: string;
}

export function LocationDisplay({
  primaryLocation,
  locations,
  compact = false,
  className = "",
}: LocationDisplayProps) {
  const { groups } = useLocations();
  const list = locations ?? [];
  const primary = primaryLocation?.trim() || null;

  if (!primary && list.length === 0) return null;

  const buckets = groupSelectedLocations(list, groups);

  return (
    <div className={`space-y-3 ${className}`}>
      {primary && (
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
            <MapPin size={15} className="text-brand-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Primary spot
            </p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90 leading-snug break-words">
              {primary}
            </p>
          </div>
        </div>
      )}

      {buckets.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {primary ? "Also available at" : "Available pickup spots"}
          </p>
          <div className={compact ? "space-y-1" : "space-y-2"}>
            {buckets.map((bucket) => (
              <div key={bucket.groupName} className="space-y-1">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {bucket.groupName}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {bucket.children.map((child) => (
                    <span
                      key={child}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                    >
                      <MapPin size={10} className="text-gray-400" />
                      {child}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationDisplay;
