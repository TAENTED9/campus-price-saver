"use client";

import { useState } from "react";
import { ShoppingBag, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ordersApi } from "@/lib/api";

interface InterestButtonProps {
  listingUuid: string;
  sellerUsername?: string;
  className?: string;
  onSuccess?: (result: { order_uuid: string; conversation_uuid: string; is_new_conversation: boolean }) => void;
}

export function InterestButton({
  listingUuid,
  sellerUsername,
  className,
  onSuccess,
}: InterestButtonProps) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!token) {
      router.push("/signin?redirect=" + encodeURIComponent(window.location.pathname));
      return;
    }
    if (done) {
      router.push("/messages");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await ordersApi.expressInterestBody(listingUuid, token);
      setDone(true);
      onSuccess?.(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send interest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm transition-all ${
          done
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90"
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : done ? (
          <CheckCircle size={16} />
        ) : (
          <ShoppingBag size={16} />
        )}
        {loading
          ? "Sending..."
          : done
          ? "Message sent — View chat"
          : "I'm Interested"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1.5 text-center">{error}</p>}
    </div>
  );
}
