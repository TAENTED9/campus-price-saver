/**
 * Cloudinary image optimization helper.
 * Inserts f_auto,q_auto,w_{width} into a Cloudinary upload URL so the CDN
 * serves the best format (WebP/AVIF) at the right size.
 *
 * Non-Cloudinary URLs are returned unchanged.
 */

const CLOUDINARY_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/;

/**
 * Returns an optimized Cloudinary URL. Falls back to the original URL for
 * non-Cloudinary sources (e.g. local uploads, external images).
 *
 * @param url    Raw image URL
 * @param width  Target display width in pixels (default 800)
 */
export function optimizeImage(url: string | null | undefined, width = 800): string {
  if (!url) return "";
  const match = url.match(CLOUDINARY_RE);
  if (!match) return url;
  // Insert transformation string right after the /upload/ segment
  return url.replace(match[1], `${match[1]}f_auto,q_auto,w_${width}/`);
}

/**
 * Returns a Cloudinary thumbnail URL (small square crop).
 * Useful for listing cards and avatars.
 *
 * @param url   Raw image URL
 * @param size  Side length in pixels (default 200)
 */
export function thumbnailImage(url: string | null | undefined, size = 200): string {
  if (!url) return "";
  const match = url.match(CLOUDINARY_RE);
  if (!match) return url;
  return url.replace(match[1], `${match[1]}f_auto,q_auto,w_${size},h_${size},c_fill/`);
}
