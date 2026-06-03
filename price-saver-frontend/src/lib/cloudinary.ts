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
  // q_auto:best keeps these large "look at the product" images visually close to
  // the original (less aggressive compression than plain q_auto). f_auto still
  // serves WebP/AVIF where supported so files stay reasonable.
  return url.replace(match[1], `${match[1]}f_auto,q_auto:best,w_${width}/`);
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
  // q_auto:good is near-lossless for small thumbnails while keeping them light.
  // dpr_2.0 doubles the delivered pixels so cards stay crisp on phone/retina
  // screens (where the device pixel ratio is 2–3×) instead of looking soft.
  return url.replace(match[1], `${match[1]}f_auto,q_auto:good,dpr_2.0,w_${size},h_${size},c_fill/`);
}

const CLOUDINARY_VIDEO_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)/;

/**
 * Returns a browser-playable Cloudinary video URL.
 *
 * Source files are stored in whatever container/codec the seller uploaded —
 * including iPhone `.mov` / HEVC, which Chrome and Firefox cannot decode. That
 * makes BOTH the inline muted preview and the click-to-watch fullscreen player
 * silently fail (the file loads but never paints/plays).
 *
 * Inserting `f_mp4,vc_h264` after `/video/upload/` tells Cloudinary to transcode
 * to H.264/MP4 on delivery (cached after the first request), which every browser
 * can play. We also swap the file extension to `.mp4` so the delivered container
 * matches. Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryVideoSrc(url: string | null | undefined): string {
  if (!url) return "";
  const match = url.match(CLOUDINARY_VIDEO_RE);
  if (!match) return url; // local/external video — serve as-is
  const transcoded = url.replace(match[1], `${match[1]}f_mp4,vc_h264,q_auto/`);
  // Replace the trailing extension (preserving any ?query) with .mp4
  return transcoded.replace(/\.(?:mov|m4v|webm|mp4|avi|mkv)(\?.*)?$/i, ".mp4$1");
}
