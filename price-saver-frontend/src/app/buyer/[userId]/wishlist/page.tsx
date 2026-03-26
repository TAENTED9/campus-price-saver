"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import buyerApi from "@/lib/buyerApi";

/**
 * Buyer Wishlist Page
 * Manage saved products and price tracking
 */

interface WishlistItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
    category: string;
  };
  seller: {
    id: string;
    name: string;
  };
  savedAt: string;
  lowestPrice?: number;
  priceHistory?: Array<{
    price: number;
    date: string;
  }>;
}

export default function WishlistPage({
  params,
}: {
  params: { userId: string };
}) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        setLoading(true);
        const data = await buyerApi.getWishlist(params.userId);
        setWishlist(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load wishlist"
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchWishlist();
    }
  }, [user, params.userId]);

  const handleRemoveItem = async (itemId: string) => {
    try {
      await buyerApi.removeFromWishlist(params.userId, itemId);
      setWishlist(wishlist.filter((item) => item.product.id !== itemId));
    } catch (err) {
      console.error("Failed to remove item from wishlist:", err);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading wishlist...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">
        My Wishlist ({wishlist.length})
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {wishlist.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">
            You haven't saved any products yet
          </p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Explore Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlist.map((item) => (
            <WishlistCard
              key={item.product.id}
              item={item}
              onRemove={() => handleRemoveItem(item.product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WishlistCard({
  item,
  onRemove,
}: {
  item: WishlistItem;
  onRemove: () => void;
}) {
  const priceChange = item.lowestPrice
    ? item.product.price - item.lowestPrice
    : 0;
  const priceChangePercent =
    item.lowestPrice && item.lowestPrice > 0
      ? ((priceChange / item.lowestPrice) * 100).toFixed(1)
      : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-gray-200 flex items-center justify-center relative">
        {item.product.image ? (
          <img
            src={item.product.image}
            alt={item.product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400">No image</span>
        )}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors"
          title="Remove from wishlist"
        >
          ✕
        </button>
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1">{item.product.category}</p>
        <h3 className="font-semibold text-sm mb-2 line-clamp-2">
          {item.product.name}
        </h3>
        <p className="text-sm text-gray-600 mb-3">{item.seller.name}</p>

        <div className="mb-3">
          <p className="text-lg font-bold">${item.product.price.toFixed(2)}</p>
          {item.lowestPrice && item.lowestPrice < item.product.price && (
            <p className="text-xs text-red-600">
              Was ${item.lowestPrice.toFixed(2)}
              <span className="ml-1">
                ({priceChangePercent}% increase)
              </span>
            </p>
          )}
          {item.lowestPrice && item.lowestPrice > item.product.price && (
            <p className="text-xs text-green-600">
              Was ${item.lowestPrice.toFixed(2)}
              <span className="ml-1">
                ({Math.abs(Number(priceChangePercent))}% decrease)
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
            Buy Now
          </button>
          <button
            onClick={onRemove}
            className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors"
          >
            Remove
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Saved {new Date(item.savedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
