"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { storefrontApi } from "@/lib/api";

interface Props {
  sellerId: number;
  initialCount: number;
}

export default function StorefrontFollowButton({ sellerId, initialCount }: Props) {
  const { token } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setLoaded(true); return; }
    storefrontApi
      .getFollowStatus(token, sellerId)
      .then((r) => { setFollowing(r.following); setCount(r.follower_count); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token, sellerId]);

  async function toggle() {
    if (!token) { router.push("/auth/signin"); return; }
    setBusy(true);
    try {
      const r = await storefrontApi.followSeller(token, sellerId);
      setFollowing(r.following);
      setCount(r.follower_count);
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <div className="w-28 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
        following
          ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/40"
          : "bg-brand-500 hover:bg-brand-600 text-white"
      }`}
    >
      <UserCheck size={15} />
      {following ? `Following · ${count.toLocaleString()}` : `Follow · ${count.toLocaleString()}`}
    </button>
  );
}
