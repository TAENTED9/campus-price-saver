"use client";

import { useState, useRef } from "react";
import { Star, Upload, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { reviewsApi, uploadApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const MAX_IMAGES = 3;

interface ReviewFormProps {
  listingId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReviewForm({ listingId, onSuccess, onCancel }: ReviewFormProps) {
  const { token } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - images.length;
    const toUpload = files.slice(0, remaining);
    if (!token) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        toUpload.map(async (file) => {
          if (file.size > 10 * 1024 * 1024) throw new Error("Each photo must be under 10 MB");
          return uploadApi.uploadReviewImage(token, file);
        })
      );
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "Photo upload failed" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    setFeedbackMsg(null);
    if (!rating) {
      setFeedbackMsg({ type: "error", text: "Please select a star rating" });
      return;
    }
    if (!text.trim() || text.trim().length < 10) {
      setFeedbackMsg({ type: "error", text: "Review must be at least 10 characters" });
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      await reviewsApi.submit(token, listingId, rating, text.trim(), images[0]);
      setFeedbackMsg({ type: "success", text: "Review posted successfully!" });
      onSuccess();
    } catch (err: unknown) {
      setFeedbackMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to post review" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
      {feedbackMsg && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl mb-3 ${
          feedbackMsg.type === "success"
            ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
        }`}>
          {feedbackMsg.type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {feedbackMsg.text}
        </div>
      )}
      <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Write Your Review</h3>

      {/* Star selector */}
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHoverRating(s)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
            className="p-1"
          >
            <Star
              size={28}
              className={`transition-colors ${
                s <= (hoverRating || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300 dark:text-gray-600"
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 self-center">
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
          </span>
        )}
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your experience with this seller..."
        rows={4}
        maxLength={1000}
        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 resize-none mb-1"
      />
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 text-right">{text.length}/1000</p>

      {/* Multi-image upload */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative">
              <img src={url} alt={`Review photo ${idx + 1}`} className="h-20 w-20 rounded-xl object-cover" />
              <button
                onClick={() => removeImage(idx)}
                aria-label={`Remove photo ${idx + 1}`}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 transition-colors text-gray-400 dark:text-gray-500">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span className="text-[10px] font-medium">
                {uploading ? "Uploading" : `Add photo`}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
        {images.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{images.length}/{MAX_IMAGES} photos</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !rating}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex-1"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          {submitting ? "Posting..." : "Post Review"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
