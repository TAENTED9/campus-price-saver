"use client";

import { useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Eye, ShieldCheck, ShoppingBag, Zap, Star } from "lucide-react";
import { thumbnailImage } from "@/lib/cloudinary";
import { useOptimisticToggle } from "@/hooks/useOptimistic";
import { InterestButton } from "./InterestButton";

export interface ListingCardProps {
  id: string | number;
  uuid?: string | null;
  title: string;
  price: number;
  condition: "new" | "fairly_used" | "used";
  imageUrl: string;
  sellerName: string;
  sellerVerified: boolean;
  category: string;
  createdAt: string;
  viewsCount?: number;
  isWishlisted?: boolean;
  onWishlistToggle?: (id: string | number) => void;
  flashSale?: boolean;
  flashSaleLabel?: string;
  isFeatured?: boolean;
  sellerAvatarUrl?: string | null;
  isNegotiable?: boolean;
  showInterestButton?: boolean;
}

const CONDITION_BADGE: Record<
  "new" | "fairly_used" | "used",
  { label: string; className: string }
> = {
  new:         { label: "New",         className: "bg-success-500 text-white" },
  fairly_used: { label: "Fairly Used", className: "bg-warning-500 text-white" },
  used:        { label: "Used",        className: "bg-gray-400 text-white"  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)    return "just now";
  if (mins < 60)   return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

export default function ListingCard({
  id,
  uuid,
  title,
  price,
  condition,
  imageUrl,
  sellerName,
  sellerVerified,
  createdAt,
  viewsCount,
  isWishlisted = false,
  onWishlistToggle,
  flashSale = false,
  flashSaleLabel,
  isFeatured = false,
  sellerAvatarUrl,
  isNegotiable = false,
  showInterestButton,
}: ListingCardProps) {
  const badge = CONDITION_BADGE[condition] ?? CONDITION_BADGE.used;
  const thumb = imageUrl ? thumbnailImage(imageUrl, 400) : "";
  const initial = (sellerName[0] ?? "S").toUpperCase();

  const wishlistAction = useCallback(async () => {
    onWishlistToggle?.(id);
  }, [id, onWishlistToggle]);

  const [wishlisted, toggleWishlist, wishlistBusy] = useOptimisticToggle(
    isWishlisted,
    wishlistAction
  );

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    if (!wishlistBusy) toggleWishlist();
  }

  return (
    <Link href={`/listing/${uuid ?? id}`} className="block">
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:shadow-blue-100/50 dark:hover:shadow-blue-950/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">

        {/* Image area */}
        <div className="relative h-44 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {thumb ? (
            <Image
              src={thumb}
              alt={title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
              <ShoppingBag size={40} strokeWidth={1.25} />
            </div>
          )}

          {/* Condition badge */}
          <span
            className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${badge.className}`}
          >
            {badge.label}
          </span>

          {/* Flash sale badge */}
          {flashSale && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
              <Zap size={9} className="fill-white" />
              {flashSaleLabel || "Flash Sale"}
            </span>
          )}

          {/* Featured star */}
          {isFeatured && (
            <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-warning-400">
              <Star size={11} className="fill-white text-white" />
            </span>
          )}

          {/* Wishlist button */}
          <button
            type="button"
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            onClick={handleWishlist}
            className="absolute top-2 right-2 w-11 h-11 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center hover:scale-110 transition-all"
          >
            <Heart
              size={14}
              className={wishlisted ? "fill-red-500 text-red-500" : "text-gray-400"}
            />
          </button>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 mb-1.5 leading-snug">
            {title}
          </h3>

          {isNegotiable && (
            <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 mb-1.5">
              NEGOTIABLE
            </span>
          )}

          <p className="text-lg font-black text-blue-600 dark:text-blue-400">
            {formatPrice(price)}
          </p>

          {/* Seller row */}
          <div className="flex items-center gap-1.5 mt-2">
            {sellerAvatarUrl ? (
              <Image
                src={sellerAvatarUrl}
                alt={sellerName}
                width={20}
                height={20}
                className="rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-[11px] font-black flex-shrink-0">
                {initial}
              </div>
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">
              {sellerName}
            </span>
            {sellerVerified && (
              <ShieldCheck size={12} className="text-blue-500 flex-shrink-0" />
            )}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-gray-400">{timeAgo(createdAt)}</span>
            {viewsCount != null && viewsCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Eye size={11} />
                {viewsCount}
              </span>
            )}
          </div>

          {/* I'm Interested button */}
          {showInterestButton && uuid && (
            <div
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="mt-2.5"
            >
              <InterestButton
                listingUuid={String(uuid)}
                className="w-full"
              />
            </div>
          )}
        </div>

      </div>
    </Link>
  );
}
