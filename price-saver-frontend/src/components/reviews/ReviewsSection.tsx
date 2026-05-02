"use client";

import { useState, useEffect } from "react";
import { Star, ChevronDown, Loader2 } from "lucide-react";
import { ReviewCard } from "./ReviewCard";
import { ReviewForm } from "./ReviewForm";
import { reviewsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface ReviewsSectionProps {
  type: "listing" | "seller";
  targetId: number;
  canReview?: boolean;
  canReply?: boolean;
}

export function ReviewsSection({ type, targetId, canReview, canReply }: ReviewsSectionProps) {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [distribution, setDist] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const LIMIT = 10;

  async function fetchReviews(skip = 0, append = false) {
    try {
      append ? setLoadingMore(true) : setLoading(true);
      const data =
        type === "listing"
          ? await reviewsApi.getForListing(targetId)
          : await reviewsApi.getForSeller(targetId);

      const reviewList = data.reviews ?? [];
      setReviews((prev) => (append ? [...prev, ...reviewList] : reviewList));
      setTotal(data.total ?? 0);
      setAvgRating(data.avg_rating ?? null);
      setHasMore((data as { has_more?: boolean }).has_more ?? false);
      const dist =
        (data as { distribution?: Record<string, number> }).distribution ??
        (data as { rating_distribution?: Record<string, number> }).rating_distribution ??
        {};
      if (Object.keys(dist).length) setDist(dist);
    } catch {
      // reviews are supplementary — silent fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const handleLoadMore = () => {
    const nextSkip = (page + 1) * LIMIT;
    setPage((p) => p + 1);
    fetchReviews(nextSkip, true);
  };

  const handleReviewSubmit = async () => {
    setShowForm(false);
    await fetchReviews();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Reviews</h2>
          {total > 0 && <span className="text-sm text-gray-400">({total})</span>}
        </div>
        {avgRating && (
          <div className="flex items-center gap-1.5">
            <Star size={16} className="fill-yellow-400 text-yellow-400" />
            <span className="font-black text-gray-900 dark:text-white">{avgRating}</span>
            <span className="text-gray-400 text-sm">/ 5</span>
          </div>
        )}
      </div>

      {/* Star distribution (seller profile only) */}
      {type === "seller" && total > 0 && Object.keys(distribution).length > 0 && (
        <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[String(star)] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-3">{star}</span>
                <Star size={11} className="fill-yellow-400 text-yellow-400 flex-shrink-0" />
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-5 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Write review button */}
      {canReview && user && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-4 py-3 border-2 border-dashed border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
        >
          Write a Review
        </button>
      )}

      {showForm && (
        <ReviewForm
          listingId={targetId}
          onSuccess={handleReviewSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Review list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8">
          <Star size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(reviews as Parameters<typeof ReviewCard>[0]["review"][]).map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showListingTitle={type === "seller"}
              canReply={canReply}
              onReply={async (reply) => {
                if (!token) return;
                await reviewsApi.sellerRespondByUuid(token, String(review.id), reply);
                await fetchReviews();
              }}
            />
          ))}
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-2.5 text-sm text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              {loadingMore ? "Loading..." : "Load more reviews"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
