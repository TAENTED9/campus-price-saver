/**
 * Centralised site-wide constants driven by env. Everything that used to be
 * hardcoded across components (support email, public domain, app name) lives
 * here so a domain or email change is a one-line .env update.
 *
 * Only NEXT_PUBLIC_* values are safe to import into client components — these
 * are exposed in the bundle, so do NOT put real secrets here.
 */

const env = process.env;

export const SUPPORT_EMAIL: string =
  env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

export const APP_URL: string = (
  env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
).replace(/\/+$/, "");

export const APP_DOMAIN: string = APP_URL.replace(/^https?:\/\//, "");

export const APP_NAME: string = env.NEXT_PUBLIC_APP_NAME?.trim() || "Campify";

export const API_URL: string =
  env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";

/** Convenience: a `mailto:` link, or "#" when support email is not configured. */
export const SUPPORT_MAILTO: string = SUPPORT_EMAIL
  ? `mailto:${SUPPORT_EMAIL}`
  : "#";
