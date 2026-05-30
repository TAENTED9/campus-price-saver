"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, X, Play, Zap } from "lucide-react";
import { uploadApi } from "@/lib/api";

/**
 * Block 5: per-listing video uploader.
 *   - Strict cap of 2 videos per listing.
 *   - 50 MB max per video. mp4 / mov / webm.
 *   - No duration window — sellers can post any length within the size cap.
 *   - During upload, the chosen file is shown as a live preview using a
 *     blob URL until the Cloudinary URL resolves; on success the preview
 *     swaps to the persisted URL so the parent form sees the canonical URL.
 */

const MAX_VIDEOS_PER_LISTING = 2;
const MAX_SIZE_MB = 50;
const ACCEPTED_MIME = "video/mp4,video/quicktime,video/webm";

type Props = {
  token: string | null;
  videos: string[];
  onChange: (next: string[]) => void;
  onError?: (msg: string) => void;
};

type PendingPreview = {
  blobUrl: string;
  fileName: string;
};

export default function ListingVideoUploader({
  token,
  videos,
  onChange,
  onError,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<PendingPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const used = videos.length;
  const remaining = Math.max(0, MAX_VIDEOS_PER_LISTING - used);

  function reportError(msg: string) {
    if (onError) onError(msg);
  }

  async function handleFile(file: File) {
    if (!token) return;
    if (videos.length >= MAX_VIDEOS_PER_LISTING) {
      reportError(`Maximum ${MAX_VIDEOS_PER_LISTING} videos per listing.`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      reportError(`Video too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }

    // Show a local preview while the upload is in flight.
    const blobUrl = URL.createObjectURL(file);
    setPending({ blobUrl, fileName: file.name });
    setUploading(true);
    try {
      const res = await uploadApi.uploadListingVideo(token, file);
      onChange([...videos, res.url]);
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setUploading(false);
      setPending((p) => {
        if (p) URL.revokeObjectURL(p.blobUrl);
        return null;
      });
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove(url: string) {
    if (!token) return;
    try {
      await uploadApi.deleteListingVideo(token, url);
      onChange(videos.filter((v) => v !== url));
    } catch (err) {
      reportError(err instanceof Error ? err.message : "Could not remove video");
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
          Product Videos
          <span className="ml-2 text-xs font-medium text-gray-400">
            ({used}/{MAX_VIDEOS_PER_LISTING})
          </span>
        </h3>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Add up to {MAX_VIDEOS_PER_LISTING} short clips of your product. MP4, MOV or WebM, up to {MAX_SIZE_MB} MB each.
      </p>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/60 dark:border-brand-500/20 dark:bg-brand-500/5 px-3 py-2">
        <Zap size={14} className="text-brand-500 mt-0.5 shrink-0" />
        <p className="text-xs text-brand-700 dark:text-brand-300">
          Videos appear in the listing&apos;s media gallery alongside your photos. Buyers tap a video&apos;s play icon to watch.
        </p>
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl p-6 text-center hover:border-brand-300 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors disabled:opacity-50"
        >
          <UploadCloud size={28} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            {uploading ? "Uploading video…" : "Tap to upload a video"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {remaining} of {MAX_VIDEOS_PER_LISTING} slot{remaining === 1 ? "" : "s"} remaining
          </p>
        </button>
      )}

      {remaining === 0 && videos.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02] px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
          Maximum {MAX_VIDEOS_PER_LISTING} videos reached. Remove one to add another.
        </div>
      )}

      {(videos.length > 0 || pending) && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {videos.map((url) => (
            <div
              key={url}
              className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group bg-black"
            >
              <video
                src={url}
                muted
                playsInline
                preload="metadata"
                className="w-full h-40 object-cover"
              />
              {/* Play-icon overlay so the thumbnail reads as a video, not a still */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                  <Play size={16} className="fill-white text-white" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(url)}
                title="Remove video"
                className="absolute top-1.5 right-1.5 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {pending && (
            <div className="relative rounded-xl overflow-hidden border border-brand-300 dark:border-brand-500/40 bg-black">
              <video
                src={pending.blobUrl}
                muted
                playsInline
                preload="metadata"
                className="w-full h-40 object-cover opacity-60"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white pointer-events-none">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-semibold">Uploading…</p>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_MIME}
        className="hidden"
        title="Upload product video"
        aria-label="Upload product video"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
