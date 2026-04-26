"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, type KarmaEntry } from "@/lib/api";
import { Zap, Star, ShieldCheck, MessageCircle, User, TrendingUp, Clock } from "lucide-react";

const TIERS = [
  { label: "New Seller",  min: 0,   max: 49,   color: "from-gray-400 to-gray-500" },
  { label: "Rising",      min: 50,  max: 199,  color: "from-blue-400 to-blue-600" },
  { label: "Trusted",     min: 200, max: 499,  color: "from-brand-400 to-brand-600" },
  { label: "Top Seller",  min: 500, max: 2000, color: "from-yellow-400 to-orange-500" },
];

function getTier(pts: number) {
  return TIERS.findLast((t) => pts >= t.min) ?? TIERS[0];
}

const REASON_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  five_star_review:   { label: "5-star review received",    icon: <Star size={13} />,          color: "text-yellow-500" },
  sale_completed:     { label: "Sale completed",            icon: <TrendingUp size={13} />,     color: "text-green-500" },
  seller_verified:    { label: "Account verified",          icon: <ShieldCheck size={13} />,    color: "text-brand-500" },
  get_verified:       { label: "Account verified",          icon: <ShieldCheck size={13} />,    color: "text-brand-500" },
  profile_complete:   { label: "Profile completed",         icon: <User size={13} />,           color: "text-purple-500" },
  inquiry_response:   { label: "Replied to inquiry",        icon: <MessageCircle size={13} />,  color: "text-cyan-500" },
};

function reasonLabel(reason: string) {
  return REASON_META[reason]?.label ?? reason.replace(/_/g, " ");
}
function reasonIcon(reason: string) {
  return REASON_META[reason]?.icon ?? <Zap size={13} />;
}
function reasonColor(reason: string) {
  return REASON_META[reason]?.color ?? "text-brand-500";
}

function timeAgo(iso: string) {
  const utc = iso && !iso.endsWith("Z") && !iso.includes("+") ? iso + "Z" : iso;
  const diff = Date.now() - new Date(utc).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PromotionsPage() {
  const { token } = useAuth();
  const [karma, setKarma] = useState(0);
  const [history, setHistory] = useState<KarmaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    sellerApi.getKarmaHistory(token, 10)
      .then((res) => {
        if (res.success) {
          setKarma(res.total);
          setHistory(res.history);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const tier = getTier(karma);
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const tierPct = nextTier
    ? Math.min(Math.round(((karma - tier.min) / (nextTier.min - tier.min)) * 100), 100)
    : 100;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Promotions</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Boost visibility using your Karma Points — 100% free</p>
      </div>

      {/* Karma balance + tier */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Your Karma Points</h3>
            <p className="text-xs text-gray-400 mt-0.5">Earn by selling, getting reviews, staying active</p>
          </div>
          {loading ? (
            <div className="h-10 w-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <div className="text-right">
              <div className="text-3xl font-black text-brand-600 dark:text-brand-400 leading-none">
                {karma.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">pts</div>
            </div>
          )}
        </div>

        {/* Tier progress */}
        {!loading && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={`font-bold bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
                {tier.label}
              </span>
              {nextTier && (
                <span className="text-gray-400">{nextTier.min - karma} pts to {nextTier.label}</span>
              )}
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${tier.color} transition-all duration-700`}
                style={{ width: `${tierPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{tier.min} pts</span>
              <span>{nextTier ? nextTier.min : tier.max}+ pts</span>
            </div>
          </div>
        )}

        {/* Boost options */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { cost: "50 pts", label: "Boost listing 24h", icon: "⚡" },
            { cost: "120 pts", label: "Category feature 48h", icon: "⭐" },
            { cost: "300 pts", label: "Homepage week", icon: "🚀" },
          ].map(({ cost, label, icon }) => (
            <div key={label} className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl opacity-60 cursor-not-allowed">
              <div className="text-2xl mb-1.5">{icon}</div>
              <div className="font-bold text-brand-600 dark:text-brand-400 text-sm">{cost}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">Boost purchasing coming soon</p>
      </div>

      {/* Recent karma history */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
            <p className="text-sm text-gray-400">No karma activity yet. Complete actions below to earn points.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className={`flex-shrink-0 ${reasonColor(entry.reason)}`}>{reasonIcon(entry.reason)}</span>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{reasonLabel(entry.reason)}</p>
                    <p className="text-[11px] text-gray-400">{timeAgo(entry.created_at)}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${entry.points >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {entry.points >= 0 ? "+" : ""}{entry.points} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flash Sales */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900 dark:text-white">Flash Sales</h3>
          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">Coming Soon</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Run a time-limited discount on any of your listings</p>
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Flash Sales Coming Soon</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">Create time-limited discounts to drive urgency and move inventory faster.</p>
        </div>
      </div>

      {/* How to earn karma */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">How to Earn Karma Points</h3>
        <div className="space-y-0">
          {[
            { action: "Publish your first listing",   pts: "+25 pts",  icon: "📦" },
            { action: "Receive a 5-star review",      pts: "+15 pts",  icon: "⭐" },
            { action: "Complete your profile",        pts: "+50 pts",  icon: "👤" },
            { action: "Get verified",                 pts: "+100 pts", icon: "✅" },
            { action: "Reply to 5 inquiries fast",    pts: "+5 pts",   icon: "💬" },
          ].map(({ action, pts, icon }) => (
            <div key={action} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
              </div>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">{pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
