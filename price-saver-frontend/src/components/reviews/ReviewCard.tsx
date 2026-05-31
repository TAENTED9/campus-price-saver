"use client";

import { Star, MessageSquare, Pencil, X } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { formatRelativeTime, minutesAgo } from "@/utils/date";
import { reviewsApi } from "@/lib/api";
import { thumbnailImage, optimizeImage } from "@/lib/cloudinary";
import { useAuth } from "@/context/AuthContext";

const EDIT_WINDOW_MINUTES = 30;

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    text: string | null;
    comment?: string | null;
    photo_url: string | null;
    created_at: string;
    seller_reply: string | null;
    seller_response?: string | null;
    replied_at: string | null;
    is_verified_purchase: boolean;
    is_verified_interaction?: boolean;
    is_edited?: boolean;
    reviewer: {
      display_name: string;
      avatar_url: string | null;
    };
    reviewer_id?: number;
    listing?: {
      uuid: string | null;
      title: string | null;
    } | null;
  };
  showListingTitle?: boolean;
  canReply?: boolean;
  onReply?: (reply: string) => Promise<void>;
  onEdited?: (updated: { text: string; photo_url: string | null }) => void;
}

export function ReviewCard({ review, showListingTitle, canReply, onReply, onEdited }: ReviewCardProps) {
  const { token, user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(review.text || review.comment || "");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const isOwner = !!user && (
    user.id === review.reviewer_id ||
    review.reviewer.display_name === user.username
  );

  useEffect(() => {
    const elapsed = minutesAgo(review.created_at);
    const remaining = EDIT_WINDOW_MINUTES - elapsed;
    if (remaining <= 0) { setMinutesLeft(null); return; }
    setMinutesLeft(Math.ceil(remaining));
    const interval = setInterval(() => {
      const e = minutesAgo(review.created_at);
      const r = EDIT_WINDOW_MINUTES - e;
      if (r <= 0) { setMinutesLeft(null); clearInterval(interval); }
      else setMinutesLeft(Math.ceil(r));
    }, 30_000);
    return () => clearInterval(interval);
  }, [review.created_at]);

  async function handleEditSubmit() {
    if (!editText.trim() || editText.trim().length < 10 || !token) return;
    setEditSubmitting(true);
    try {
      await reviewsApi.editReview(token, review.id, editText.trim());
      onEdited?.({ text: editText.trim(), photo_url: review.photo_url });
      setEditing(false);
    } catch {
      // silently keep form open on error
    } finally {
      setEditSubmitting(false);
    }
  }

  const displayText = editing ? null : (review.text || review.comment || null);
  const sellerReply = review.seller_reply || review.seller_response || null;
  const verified = review.is_verified_purchase || review.is_verified_interaction || false;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
      {/* Reviewer header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
            {review.reviewer.avatar_url ? (
              <Image
                src={review.reviewer.avatar_url}
                alt={review.reviewer.display_name}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              review.reviewer.display_name[0]?.toUpperCase() ?? "U"
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {review.reviewer.display_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(review.created_at)}
              {verified && (
                <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">
                  Verified
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Star rating */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                className={
                  s <= review.rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-200 dark:text-gray-700"
                }
              />
            ))}
          </div>
          {/* Edit button (visible to reviewer within 30 min) */}
          {isOwner && minutesLeft !== null && (
            <button
              onClick={() => { setEditing(!editing); setEditText(review.text || review.comment || ""); }}
              title={`Edit review (${minutesLeft}m left)`}
              className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
            >
              <Pencil size={11} />
              <span>{minutesLeft}m</span>
            </button>
          )}
        </div>
      </div>

      {/* Listing context */}
      {showListingTitle && review.listing?.title && (
        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
          re: {review.listing.title}
        </p>
      )}

      {/* Review text */}
      {displayText && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-1">
          {displayText}
        </p>
      )}
      {!editing && review.is_edited && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">edited</p>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className="mb-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-label="Edit your review"
            placeholder="Update your review..."
            className="w-full bg-gray-50 dark:bg-gray-800 border border-blue-400 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none resize-none"
          />
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={handleEditSubmit}
              disabled={editSubmitting || editText.trim().length < 10}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
            >
              {editSubmitting ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Review photo — compact square thumbnail, click to view full size */}
      {review.photo_url && (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          aria-label="View review photo"
          className="relative h-28 w-28 rounded-xl overflow-hidden mb-3 border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Image
            src={thumbnailImage(review.photo_url, 224)}
            alt="Review photo"
            fill
            sizes="112px"
            className="object-cover"
          />
        </button>
      )}

      {/* Lightbox — full-size view on demand */}
      {photoOpen && review.photo_url && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setPhotoOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close photo"
            onClick={() => setPhotoOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={optimizeImage(review.photo_url, 1000)}
            alt="Review photo"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Seller reply */}
      {sellerReply && (
        <div className="mt-3 ml-3 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
            Seller replied
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{sellerReply}</p>
        </div>
      )}

      {/* Seller reply form */}
      {canReply && !sellerReply && (
        <div className="mt-3">
          {!showReplyForm ? (
            <button
              onClick={() => setShowReplyForm(true)}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              <MessageSquare size={12} />
              Reply to this review
            </button>
          ) : (
            <div className="mt-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your reply..."
                rows={3}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    if (!reply.trim()) return;
                    setSubmitting(true);
                    await onReply?.(reply);
                    setSubmitting(false);
                    setShowReplyForm(false);
                  }}
                  disabled={submitting || !reply.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Posting..." : "Post Reply"}
                </button>
                <button
                  onClick={() => {
                    setShowReplyForm(false);
                    setReply("");
                  }}
                  className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
