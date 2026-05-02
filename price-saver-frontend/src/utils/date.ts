/**
 * Date / time formatting utilities — all output uses WAT (West Africa Time, UTC+1).
 */

const WAT_LOCALE = "en-NG";
const WAT_TZ = "Africa/Lagos";

/**
 * Parse an ISO string coming from the backend.
 * Strings without a timezone offset (naive UTC from old data) are treated as UTC;
 * strings with "+01:00" (WAT) are parsed as-is.
 */
function parseBackendDate(isoStr: string): Date {
  if (!isoStr) return new Date(NaN);
  // If the string already has timezone info, Date.parse handles it correctly.
  // If it's naive (no Z, no +HH:MM), it's old UTC data — append Z.
  const hasOffset = /[Z]$|[+-]\d{2}:\d{2}$/.test(isoStr);
  return new Date(hasOffset ? isoStr : isoStr + "Z");
}

/**
 * Returns a human-readable relative time string in WAT.
 * e.g. "Today", "Yesterday", "3d ago", "2mo ago"
 */
export function formatRelativeTime(isoStr: string): string {
  const date = parseBackendDate(isoStr);
  if (isNaN(date.getTime())) return "";

  const nowMs = Date.now();
  const diffMs = nowMs - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

/**
 * Formats a timestamp as a short WAT time string, e.g. "3:45 PM".
 */
export function formatTimeWAT(isoStr: string): string {
  const date = parseBackendDate(isoStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(WAT_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: WAT_TZ,
  });
}

/**
 * Formats a timestamp as a full WAT date+time string, e.g. "Jan 15, 2025, 3:45 PM".
 */
export function formatDateTimeWAT(isoStr: string): string {
  const date = parseBackendDate(isoStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(WAT_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: WAT_TZ,
  });
}

/**
 * Formats a timestamp as a short date, e.g. "Jan 15".
 * Includes year only when it differs from the current year.
 */
export function formatDateShortWAT(isoStr: string): string {
  const date = parseBackendDate(isoStr);
  if (isNaN(date.getTime())) return "";
  const nowYear = new Date().toLocaleString("en-US", { year: "numeric", timeZone: WAT_TZ });
  const dateYear = date.toLocaleString("en-US", { year: "numeric", timeZone: WAT_TZ });
  return date.toLocaleDateString(WAT_LOCALE, {
    month: "short",
    day: "numeric",
    ...(nowYear !== dateYear ? { year: "numeric" } : {}),
    timeZone: WAT_TZ,
  });
}

/**
 * Returns minutes elapsed since the given ISO string.
 */
export function minutesAgo(isoStr: string): number {
  const date = parseBackendDate(isoStr);
  if (isNaN(date.getTime())) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / 60_000);
}
