"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { storefrontApi } from "@/lib/api";
import { useOptimisticToggle } from "@/hooks/useOptimistic";

interface Props {
  sellerId: number;
  initialCount: number;
}

export default function StorefrontFollowButton({ sellerId, initialCount }: Props) {
  const { token } = useAuth();
  const router = useRouter();
  const [serverFollowing, setServerFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) { setLoaded(true); return; }
    storefrontApi
      .getFollowStatus(token, sellerId)
      .then((r) => { setServerFollowing(r.following); setCount(r.follower_count); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token, sellerId]);

  const followAction = useCallback(async (next: boolean) => {
    if (!token) { router.push("/auth/signin"); return; }
    const r = await storefrontApi.followSeller(token, sellerId);
    setCount(r.follower_count);
    setServerFollowing(r.following);
    // suppress unused next warning
    void next;
  }, [token, sellerId, router]);

  const [following, toggle, busy] = useOptimisticToggle(serverFollowing, followAction);

  if (!loaded) {
    return <div className="w-28 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  }

  return (
    <button
      onClick={() => toggle()}
      disabled={busy}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
        following
          ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/40"
          : "bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-blue-200/50"
      }`}
    >
      {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
      {following ? `Following · ${count.toLocaleString()}` : `Follow · ${count.toLocaleString()}`}
    </button>
  );
}
