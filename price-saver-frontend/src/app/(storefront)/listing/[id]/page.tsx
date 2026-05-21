"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { listingApi, storefrontApi, wishlistApi, type ListingDetail, type FollowStatus } from "@/lib/api";
import { messageApi } from "@/lib/messageApi";
import { optimizeImage, thumbnailImage } from "@/lib/cloudinary";
import { formatPrice } from "@/lib/formatPrice";
import { Heart, Flag, Eye, MapPin, Package, Truck, ChevronRight, ArrowLeft, X, Star, ShieldCheck, MessageCircle, Award, Check, CheckCircle2 } from "lucide-react";
import { InterestButton } from "@/components/marketplace/InterestButton";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";

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
  const [mainPhoto, setMainPhoto] = useState(0);

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
          {/* Left — Photos + Description */}
          <div className="lg:col-span-3 space-y-4">
            {/* Main photo */}
            <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-brand-50 to-accent-500/10 dark:from-brand-500/10 dark:to-accent-500/5 relative flex items-center justify-center">
              {photos.length > 0
                ? <Image src={optimizeImage(photos[mainPhoto], 800)} alt={listing.name} fill sizes="(max-width: 768px) 100vw, 800px" className="object-cover" />
                : <span className="text-7xl font-black text-brand-200 dark:text-brand-800">
                    {listing.name.charAt(0).toUpperCase()}
                  </span>
              }
            </div>
            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="flex gap-2">
                {photos.map((url, i) => (
                  <button key={i} type="button" title={`Photo ${i + 1}`}
                    onClick={() => setMainPhoto(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${mainPhoto === i ? "border-brand-500" : "border-transparent"}`}>
                    <Image src={thumbnailImage(url, 80)} alt={`Thumbnail ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
                  </button>
                ))}
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

              {/* Meta */}
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {listing.quantity > 1 && (
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-gray-400" />
                    <span>{listing.quantity} available</span>
                  </div>
                )}
                {listing.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-gray-400" />
                    <span>{listing.location}</span>
                  </div>
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
    </>
  );
}
