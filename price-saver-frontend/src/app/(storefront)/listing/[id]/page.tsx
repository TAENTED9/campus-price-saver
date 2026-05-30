"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { listingApi, storefrontApi, wishlistApi, type ListingDetail, type FollowStatus } from "@/lib/api";
import { messageApi } from "@/lib/messageApi";
import { optimizeImage, thumbnailImage, cloudinaryVideoSrc } from "@/lib/cloudinary";
import { formatPrice } from "@/lib/formatPrice";
import { Heart, Flag, Eye, Package, Truck, ChevronRight, ArrowLeft, X, Star, ShieldCheck, MessageCircle, Award, Check, CheckCircle2, Play, Maximize2 } from "lucide-react";

// Block 5: Cloudinary video URLs can be transformed to a JPG thumbnail of the
// first frame by swapping the extension. Used for the gallery strip so videos
// read as recognizable thumbnails (with a play-icon overlay) rather than blank
// black tiles.
function cloudinaryVideoThumb(videoUrl: string): string | null {
  if (!videoUrl || !videoUrl.includes("/video/upload/")) return null;
  const lower = videoUrl.toLowerCase();
  for (const ext of [".mp4", ".mov", ".webm", ".m4v"]) {
    if (lower.endsWith(ext)) return videoUrl.slice(0, -ext.length) + ".jpg";
  }
  return null;
}

// Map file extension → MIME type for the <source type=...> attribute.
// Some CDNs (and dev servers) return generic Content-Type headers for video
// files, which can cause Chrome to drop the load. Declaring the type on
// <source> tells the browser exactly which codec to expect, sidestepping
// that whole class of "blank player" bugs.
function videoMimeType(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov") || lower.endsWith(".m4v")) return "video/quicktime";
  return "video/mp4"; // default — covers .mp4 and Cloudinary URLs with no extension
}

// Shared play()-with-click-fallback. If the browser blocks autoplay (e.g.
// strict mobile policy), we attach a one-shot document click listener that
// kicks playback off on the user's next tap — matches the user's expected
// "tap anywhere to play" mental model without spamming the console.
function tryAutoplayWithFallback(v: HTMLVideoElement) {
  v.muted = true;
  const p = v.play();
  if (!p || typeof p.catch !== "function") return;
  p.catch(() => {
    const resume = () => { v.play().catch(() => {}); };
    document.addEventListener("click", resume, { once: true });
    document.addEventListener("touchstart", resume, { once: true, passive: true });
  });
}

// Extension-based check used by the carousel state machine: strip query
// params first so Cloudinary cache-bust suffixes don't fool us, then match
// the canonical video extensions case-insensitively.
function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    clean.endsWith(".m3u8")
  );
}

type GalleryItem =
  | { kind: "photo"; url: string }
  | { kind: "video"; url: string; thumbUrl: string | null };
import { InterestButton } from "@/components/marketplace/InterestButton";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { LocationDisplay } from "@/components/locations/LocationDisplay";

function Initials({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const letters = name.trim().slice(0, 2).toUpperCase();
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-11 h-11 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {letters}
    </div>
  );
}

function conditionColor(c: string) {
  if (c === "New") return "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400";
  if (c === "Fairly Used") return "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

function availStyle(s: string) {
  if (s === "open") return "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400";
  if (s === "limited") return "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400";
  return "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400";
}

// Modal
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 dark:text-white">{title}</h3>
          <button type="button" title="Close" onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const REPORT_REASONS = ["Misleading info", "Wrong price", "Spam", "Inappropriate content", "Other"] as const;

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [similar, setSimilar] = useState<ListingDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Gallery state machine ──────────────────────────────────────────────
  // Mirrors the proven carousel pattern: a master autoplay toggle, an index
  // pointer into the unified media array, and a "video is playing" flag that
  // hard-locks the carousel for the duration of playback. Each state has a
  // single owner — no derived state that could drift out of sync.
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isGalleryAutoPlaying, setIsGalleryAutoPlaying] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [followState, setFollowState] = useState<FollowStatus | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryMsg, setInquiryMsg] = useState("");
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [startingDM, setStartingDM] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Video viewer (lightbox) — opens a fullscreen player with sound when
  // the user taps the autoplaying muted preview.
  const [videoViewerUrl, setVideoViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const isNumeric = /^\d+$/.test(id);

    if (isNumeric) {
      const numId = Number(id);
      listingApi.getDetail(numId)
        .then((data) => {
          setListing(data);
          setLoading(false);
          // BUG-009: record view using UUID from fetched listing
          if (data.uuid) listingApi.recordView(data.uuid).catch(() => {});
        })
        .catch(() => setLoading(false));
      listingApi.getSimilar(numId).then(setSimilar).catch(() => {});
    } else {
      listingApi.getDetailBySlug(id)
        .then((data) => {
          setListing(data);
          setLoading(false);
          listingApi.getSimilar(data.id).then(setSimilar).catch(() => {});
          listingApi.recordView(id).catch(() => {});
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    if (!token || !listing?.seller?.id) return;
    storefrontApi.getFollowStatus(token, listing.seller.id).then(setFollowState).catch(() => {});
    wishlistApi.status(token, listing.id).then((r) => setWishlisted(r.wishlisted)).catch(() => {});
  }, [token, listing?.seller?.id, listing?.id]);

  // ── Gallery autoplay interval ──────────────────────────────────────────
  // Master gate. The interval only runs when:
  //   • autoplay master toggle is on (paused by manual nav / video play)
  //   • current item is NOT a video (videos own their own timeline)
  //   • there's more than one media item (single-item gallery has no rotation)
  //
  // Each tick advances the index, skipping over any videos in the array so
  // the carousel never silently auto-plays a video. The do-while bounds at
  // `maxLoops` so an all-video media set just freezes on the first item
  // instead of infinite-looping.
  const galleryMediaLen =
    (listing?.photos?.length ?? 0) + (listing?.videos?.length ?? 0);
  const galleryMediaUrls: string[] = listing
    ? [...(listing.photos ?? []), ...(listing.videos ?? [])]
    : [];
  const isCurrentMediaVideo = isVideoUrl(galleryMediaUrls[currentImageIndex]);

  useEffect(() => {
    // Gate the interval on every condition that means "do not advance":
    // master toggle off, the current slot is a video, the video element
    // reports it is actively playing, or there's nothing to rotate to.
    if (
      !isGalleryAutoPlaying ||
      isCurrentMediaVideo ||
      isVideoPlaying ||
      galleryMediaLen <= 1
    ) {
      return;
    }
    const id = setInterval(() => {
      setCurrentImageIndex((prev) => {
        let next = prev;
        const max = galleryMediaLen;
        let loops = 0;
        do {
          next = (next + 1) % galleryMediaLen;
          loops++;
          if (loops >= max) break;
        } while (isVideoUrl(galleryMediaUrls[next]) && loops < max);
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
    // Re-bind the interval whenever any of the gate inputs change so the
    // closure can't hold a stale `galleryMediaUrls` reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGalleryAutoPlaying, isCurrentMediaVideo, isVideoPlaying, galleryMediaLen]);

  // Manual thumbnail click → immediate pause; if the user landed on an
  // image, resume autoplay 10s later. Returns a cleanup so rapid double-
  // clicks don't leave ghost timers behind.
  const handleManualImageChange = (newIndex: number) => {
    setIsGalleryAutoPlaying(false);
    setCurrentImageIndex(newIndex);
    const targetIsVideo = isVideoUrl(galleryMediaUrls[newIndex]);
    setIsVideoPlaying(targetIsVideo);
    if (!targetIsVideo) {
      const t = setTimeout(() => setIsGalleryAutoPlaying(true), 10000);
      return () => clearTimeout(t);
    }
  };

  // Used by video.onEnded — advance to the next media slot, then let the
  // interval pick back up.
  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      galleryMediaLen > 0 ? (prev + 1) % galleryMediaLen : 0,
    );
  };

  // If the underlying listing reloads (e.g. navigation between two listing
  // pages on the same component instance) reset the carousel so we don't
  // try to render index 7 of a 3-item gallery.
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsGalleryAutoPlaying(true);
    setIsVideoPlaying(false);
  }, [listing?.id]);

  async function toggleWishlist() {
    if (!token) { router.push("/signin"); return; }
    const numId = listing?.id ?? Number(id);
    // FIX #13: optimistic toggle with rollback on failure.
    const previous = wishlisted;
    setWishlisted(!wishlisted);
    setWishlistLoading(true);
    try {
      const res = await wishlistApi.toggle(token, numId);
      setWishlisted(res.wishlisted);
      // Block 2: server is source of truth. Just notify the sidebar to refetch.
      window.dispatchEvent(new CustomEvent("wl-changed"));
    } catch {
      setWishlisted(previous); // rollback
    } finally {
      setWishlistLoading(false);
    }
  }

  async function toggleFollow() {
    if (!token) { router.push("/signin"); return; }
    if (!listing?.seller?.id) return;
    setFollowLoading(true);
    try {
      const res = await storefrontApi.followSeller(token, listing.seller.id);
      setFollowState(res);
    } catch { /* silent */ }
    finally { setFollowLoading(false); }
  }

  async function handleMessageSeller() {
    if (!token) { router.push("/signin"); return; }
    if (!listing?.seller?.id) return;
    setStartingDM(true);
    try {
      const conv = await messageApi.startConversation(listing.seller.id, token);
      if (!conv.last_message_preview) {
        const opener = `Hi, I'm interested in "${listing.name}" (${formatPrice(listing.price)}). Is it still available?`;
        await messageApi.sendMessage(listing.seller.id, opener, token).catch(() => {});
      }
      // FIX #9: buyers' inbox lives under /dashboard/messages, not /messages.
      // Pass the conversation handle so the page can open it directly.
      const convHandle =
        (conv as { conversation_uuid?: string; uuid?: string; id?: number }).conversation_uuid ??
        (conv as { uuid?: string }).uuid ??
        (conv as { id?: number }).id;
      const qs = convHandle != null ? `?conversation=${encodeURIComponent(String(convHandle))}` : "";
      router.push(`/dashboard/messages${qs}`);
    } catch { /* silent */ }
    finally { setStartingDM(false); }
  }

  async function sendInquiry() {
    if (!token) { router.push("/signin"); return; }
    if (!inquiryMsg.trim() || !listing) return;
    setSendingInquiry(true);
    try {
      await listingApi.sendInquiry(token, listing.id, inquiryMsg.trim());
      setInquirySent(true);
      setInquiryMsg("");
    } catch (err) {
      setInquiryError(err instanceof Error ? err.message : "Failed to send");
    } finally { setSendingInquiry(false); }
  }

  async function sendReport() {
    if (!token) { router.push("/signin"); return; }
    if (!listing) return;
    setSendingReport(true);
    try {
      await listingApi.report(token, listing.id, reportReason, reportNote || undefined);
      setReportSent(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Failed to report");
    } finally { setSendingReport(false); }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="h-8 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 aspect-square rounded-2xl bg-gray-200 dark:bg-gray-700" />
          <div className="lg:col-span-2 space-y-4">
            <div className="h-6 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-10 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Listing not found.</p>
        <Link href="/" className="mt-4 inline-block text-brand-500 hover:underline">Back to home</Link>
      </div>
    );
  }

  const photos = listing.photos?.length ? listing.photos : [];
  const videos = listing.videos?.length ? listing.videos : [];
  // Block 5: unified media array — photos first (in upload order), videos
  // after. The seller's chosen cover (photo #1) stays the default main item;
  // listings with no photos fall back to the first video as the main item.
  const media: GalleryItem[] = [
    ...photos.map((url) => ({ kind: "photo" as const, url })),
    ...videos.map((url) => ({
      kind: "video" as const,
      url,
      thumbUrl: cloudinaryVideoThumb(url),
    })),
  ];
  // The state machine owns `currentImageIndex`. Fall back to slot 0 if the
  // index is somehow out of range (e.g. after a listing swap that didn't
  // trigger the reset effect yet).
  const activeItem = media[currentImageIndex] ?? media[0] ?? null;
  const seller = listing.seller;
  const deliveryParts = listing.delivery_options?.split(",") ?? [];

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Back */}
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left — Unified media gallery + description */}
          <div className="lg:col-span-3 space-y-4">
            {/* Main viewer — photo OR video. Tapping a thumbnail below swaps this. */}
            <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-brand-50 to-accent-500/10 dark:from-brand-500/10 dark:to-accent-500/5 relative flex items-center justify-center">
              {activeItem?.kind === "photo" && (
                <Image
                  src={optimizeImage(activeItem.url, 800)}
                  alt={listing.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="object-cover"
                />
              )}
              {activeItem?.kind === "video" && (
                <>
                  <video
                    key={activeItem.url}
                    poster={cloudinaryVideoThumb(activeItem.url) ?? undefined}
                    autoPlay
                    muted
                    playsInline
                    controls
                    preload="auto"
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                    onLoadedMetadata={(e) => {
                      // React's `muted` JSX prop doesn't always reflect onto
                      // the DOM node before the browser evaluates autoplay
                      // policy. Force it on the actual element here.
                      e.currentTarget.muted = true;
                      e.currentTarget.defaultMuted = true;
                    }}
                    onCanPlay={(e) => tryAutoplayWithFallback(e.currentTarget)}
                    // Video playback owns the gallery: hard-lock the carousel
                    // while the user is watching so it doesn't slide out from
                    // under them mid-frame.
                    onPlay={() => {
                      setIsVideoPlaying(true);
                      setIsGalleryAutoPlaying(false);
                    }}
                    onPause={() => setIsVideoPlaying(false)}
                    // Video finished naturally → release the lock, advance to
                    // the next media item, resume the carousel.
                    onEnded={() => {
                      setIsVideoPlaying(false);
                      handleNextImage();
                      setIsGalleryAutoPlaying(true);
                    }}
                  >
                    {/* Explicit <source> + MIME type tells the browser exactly
                        what codec to expect, even if the CDN returns a generic
                        Content-Type header. Eliminates the "blank player"
                        failure mode on Chrome when MIME sniffing falls back. */}
                    <source src={cloudinaryVideoSrc(activeItem.url)} type={videoMimeType(cloudinaryVideoSrc(activeItem.url))} />
                    Your browser does not support inline video playback.
                  </video>
                  {/* Expand to fullscreen viewer — sits on top of native
                      controls, deliberately small + top-right so it doesn't
                      cover the control bar. */}
                  <button
                    type="button"
                    title="View video fullscreen"
                    onClick={() => setVideoViewerUrl(activeItem.url)}
                    className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 flex items-center justify-center text-white transition-colors"
                  >
                    <Maximize2 size={16} />
                  </button>
                </>
              )}
              {!activeItem && (
                <span className="text-7xl font-black text-brand-200 dark:text-brand-800">
                  {listing.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Unified thumbnail strip — photos + videos together, scrolls
                horizontally on mobile, wraps on desktop. Videos show a
                play-icon overlay so the kind is obvious before tapping. */}
            {media.length > 1 && (
              <div className="flex md:flex-wrap gap-2 overflow-x-auto md:overflow-visible -mx-1 px-1 pb-1">
                {media.map((item, i) => {
                  const isActive = currentImageIndex === i;
                  return (
                    <button
                      key={`${item.kind}-${item.url}`}
                      type="button"
                      title={item.kind === "video" ? `Video ${i + 1}` : `Photo ${i + 1}`}
                      onClick={() => handleManualImageChange(i)}
                      className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${isActive ? "border-brand-500" : "border-transparent"}`}
                    >
                      {item.kind === "photo" ? (
                        <Image
                          src={thumbnailImage(item.url, 80)}
                          alt={`Thumbnail ${i + 1}`}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : item.thumbUrl ? (
                        <Image
                          src={item.thumbUrl}
                          alt={`Video thumbnail ${i + 1}`}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover bg-black"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-black" />
                      )}
                      {item.kind === "video" && (
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                            <Play size={10} className="fill-white text-white" />
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Description */}
            {listing.description && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5">
                <h3 className="font-bold text-gray-800 dark:text-white mb-2">Description</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {listing.description}
                </p>
              </div>
            )}
          </div>

          {/* Right — Details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title + price */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5">
              <div className="flex items-start gap-2 mb-2">
                <h1 className="text-xl font-black text-gray-800 dark:text-white flex-1">{listing.name}</h1>
                {seller?.verified && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10 flex-shrink-0">
                    <ShieldCheck size={10} /> Verified
                  </span>
                )}
              </div>

              <p className="text-3xl font-black text-brand-500 mb-2">{formatPrice(listing.price)}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {listing.is_negotiable && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400 font-medium">Negotiable</span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${conditionColor(listing.condition)}`}>
                  {listing.condition}
                </span>
                {listing.subcategory && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{listing.subcategory}</span>
                )}
              </div>

              {/* Brand + pack info — only renders when the seller filled them in */}
              {(listing.brand || listing.pack_size || listing.pack_unit) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {listing.brand && (
                    <span><span className="text-gray-400">Brand</span> <span className="font-semibold text-gray-800 dark:text-white/90">{listing.brand}</span></span>
                  )}
                  {(listing.pack_size || listing.pack_unit) && (
                    <span><span className="text-gray-400">Pack</span> <span className="font-semibold text-gray-800 dark:text-white/90">{[listing.pack_size, listing.pack_unit].filter(Boolean).join(" ")}</span></span>
                  )}
                </div>
              )}

              {/* Meta */}
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {listing.quantity > 1 && (
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-gray-400" />
                    <span>{listing.quantity} available</span>
                  </div>
                )}
                {(listing.location || (listing.locations && listing.locations.length > 0)) && (
                  <LocationDisplay
                    primaryLocation={listing.location}
                    locations={listing.locations}
                    className="py-1"
                  />
                )}
                {deliveryParts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-gray-400" />
                    <span>{deliveryParts.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(" & ")}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                  <Eye size={12} /> {listing.view_count.toLocaleString()} views
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 space-y-2">
                {/* I'm Interested button */}
                {listing?.seller && user?.id !== seller?.id && listing.uuid && (
                  <InterestButton
                    listingUuid={listing.uuid}
                    sellerUsername={seller?.username}
                    className="w-full"
                  />
                )}
{/* MISS-003: only render when seller is present */}
                {listing?.seller && (
                <button type="button"
                  onClick={() => {
                    if (id && !/^\d+$/.test(id)) listingApi.recordInterest(id).catch(() => {});
                    handleMessageSeller();
                  }}
                  disabled={startingDM}
                  className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                  {startingDM
                    ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <><MessageCircle size={14} /> Message Seller</>}
                </button>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={toggleWishlist} disabled={wishlistLoading}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-60 ${
                      wishlisted
                        ? "bg-red-50 border-red-200 text-red-500 dark:bg-red-500/10 dark:border-red-500/30"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}>
                    <Heart size={14} className={`inline mr-1 ${wishlisted ? "fill-red-500 text-red-500" : ""}`} />
                    {wishlisted ? "Saved" : "Save"}
                  </button>
                  <button type="button" onClick={() => setReportOpen(true)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <Flag size={14} className="inline mr-1" /> Report
                  </button>
                </div>
              </div>
            </div>

            {/* Seller card */}
            {seller && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Seller</h3>
                <div className="flex items-center gap-3 mb-3">
                  {seller.avatar_url
                    ? <Image src={thumbnailImage(seller.avatar_url, 60)} alt={seller.display_name} width={44} height={44} className="w-11 h-11 rounded-full object-cover" />
                    : <Initials name={seller.display_name} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 dark:text-white text-sm truncate">{seller.display_name}</p>
                    <p className="text-xs text-gray-400">@{seller.username}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${availStyle(seller.availability_status)}`}>
                    {seller.availability_status.charAt(0).toUpperCase() + seller.availability_status.slice(1)}
                  </span>
                </div>
                {seller.bio && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{seller.bio}</p>
                )}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-xs text-gray-400">{seller.follower_count} followers</span>
                  {seller.avg_rating != null && (
                    <span className="flex items-center gap-0.5 text-xs text-yellow-500 font-semibold">
                      <Star size={11} className="fill-yellow-400" /> {seller.avg_rating} ({seller.review_count})
                    </span>
                  )}
                  {seller.trust_tier && seller.trust_tier !== "new_seller" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10">
                      <Award size={10} />
                      {seller.trust_tier === "top_seller" ? "Top Seller" : seller.trust_tier === "trusted" ? "Trusted" : "Rising"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link href={`/store/${seller.username}`}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-center text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-1">
                    View Store <ChevronRight size={12} />
                  </Link>
                  {user?.id !== seller.id && (
                    <button type="button" onClick={toggleFollow} disabled={followLoading}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                        followState?.following
                          ? "bg-brand-50 text-brand-500 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30"
                          : "bg-brand-500 text-white hover:bg-brand-600"
                      }`}>
                      {followState?.following ? <><Check size={12} className="inline mr-1" />Following</> : "Follow"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <ReviewsSection
            type="listing"
            targetId={listing.id}
            canReview={!!(user && seller && user.id !== seller.id)}
          />
        </div>

        {/* Similar listings */}
        {similar.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white mb-4">Similar Listings</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {similar.map((s) => (
                <Link key={s.id} href={`/listing/${s.uuid ?? s.id}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="aspect-square bg-gradient-to-br from-brand-50 to-accent-500/10 dark:from-brand-500/10 relative flex items-center justify-center overflow-hidden">
                    {s.photos?.[0]
                      ? <Image src={thumbnailImage(s.photos[0], 200)} alt={s.name} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <span className="text-2xl font-black text-brand-200 dark:text-brand-700">{s.name.charAt(0)}</span>}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{s.name}</p>
                    <p className="text-xs font-bold text-brand-500">{formatPrice(s.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inquiry Modal */}
      {inquiryOpen && (
        <Modal title="Message Seller" onClose={() => { setInquiryOpen(false); setInquirySent(false); }}>
          {inquirySent ? (
            <div className="text-center py-6">
              <div className="mb-3 flex justify-center"><CheckCircle2 size={40} className="text-green-500" /></div>
              <p className="font-bold text-gray-800 dark:text-white">Message sent!</p>
              <p className="text-sm text-gray-500 mt-1">The seller will see your message in their inbox.</p>
              <button type="button" onClick={() => { setInquiryOpen(false); setInquirySent(false); }}
                className="mt-4 px-6 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold">Done</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sending to <strong>{listing.seller?.display_name}</strong> about <strong>{listing.name}</strong>
              </p>
              {inquiryError && <p className="text-sm text-red-500">{inquiryError}</p>}
              <textarea value={inquiryMsg} onChange={(e) => { setInquiryError(null); setInquiryMsg(e.target.value); }} rows={4}
                placeholder="Hi, I'm interested in this item. Is it still available?"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-3 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10" />
              <button type="button" onClick={sendInquiry} disabled={sendingInquiry || !inquiryMsg.trim()}
                className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {sendingInquiry ? "Sending..." : "Send Message"}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <Modal title="Report Listing" onClose={() => { setReportOpen(false); setReportSent(false); }}>
          {reportSent ? (
            <div className="text-center py-6">
              <div className="mb-3 flex justify-center"><Flag size={40} className="text-red-500" /></div>
              <p className="font-bold text-gray-800 dark:text-white">Report submitted</p>
              <p className="text-sm text-gray-500 mt-1">Our team will review this listing.</p>
              <button type="button" onClick={() => { setReportOpen(false); setReportSent(false); }}
                className="mt-4 px-6 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold">Close</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} title="Report reason"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:[color-scheme:dark] px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-300 focus:outline-hidden">
                  {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Additional notes (optional)</label>
                <textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} rows={3}
                  placeholder="Any extra details..."
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-3 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10" />
              </div>
              {reportError && <p className="text-sm text-red-500">{reportError}</p>}
              <button type="button" onClick={() => { setReportError(null); sendReport(); }} disabled={sendingReport}
                className="w-full py-2.5 rounded-xl bg-error-500 hover:bg-error-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {sendingReport ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Fullscreen video viewer */}
      {videoViewerUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setVideoViewerUrl(null)}
        >
          <button
            type="button"
            title="Close"
            onClick={() => setVideoViewerUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={20} />
          </button>
          <video
            src={cloudinaryVideoSrc(videoViewerUrl)}
            autoPlay
            controls
            playsInline
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
