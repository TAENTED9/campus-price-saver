"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";
import { Store, ChevronRight, ShieldCheck, Zap, Star } from "lucide-react";

const CATEGORIES = [
  "Food & Groceries", "Fashion & Clothing", "Electronics & Gadgets",
  "Books & Stationery", "Beauty & Personal Care", "Home & Kitchen",
  "Health & Wellness", "Services", "Handmade & Crafts", "Other",
];

const PICKUP_SPOTS = [
  "GTBank bus stop", "Moremi Hall gate", "Faculty of Science gate",
  "University Senate building", "Amina Hall", "Kuti Hall",
  "Angola", "Nithub", "New Hall", "Freedom Park",
  "Main Auditorium", "Yaba/Akoka Gate",
];

const inp = "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 dark:[color-scheme:dark] transition-colors";

const PERKS = [
  { icon: <Zap size={18} className="text-warning-500" />, text: "List in under 3 minutes" },
  { icon: <ShieldCheck size={18} className="text-brand-500" />, text: "Verified badge boosts trust" },
  { icon: <Star size={18} className="text-orange-400" />, text: "Earn seller points & rewards" },
];

export default function SellerApplyPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();

  const [bizName, setBizName]               = useState(user?.display_name || "");
  const [category, setCategory]             = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [bio, setBio]                       = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace("/signin?redirect=/seller/apply");
    if (!isLoading && user?.role === "seller") router.replace("/seller");
  }, [isLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!bizName.trim()) return setError("Business / seller name is required.");
    if (!category) return setError("Please select your primary category.");
    setSubmitting(true);
    setError("");
    try {
      await sellerApi.apply(token, {
        business_name: bizName.trim(),
        category,
        pickup_location: pickupLocation,
        bio: bio.trim() || undefined,
      });
      router.push("/seller/verify?ref=welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">

      {/* Logo / back link */}
      <Link href="/" className="flex items-center gap-2 mb-8 text-gray-600 dark:text-gray-400 hover:text-brand-500 transition-colors">
        <Store size={22} className="text-brand-500" />
        <span className="font-black text-lg tracking-tight text-gray-800 dark:text-white">UNILAG Price Saver</span>
      </Link>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/20">
            <Store size={26} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Start Selling Free</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Set up your store in seconds. Verification comes next.
          </p>
        </div>

        {/* Perks */}
        <div className="flex justify-center gap-6 mb-7">
          {PERKS.map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-1 text-center">
              {p.icon}
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{p.text}</span>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business / seller name */}
            <div>
              <label htmlFor="biz-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Business / Seller Name <span className="text-red-500">*</span>
              </label>
              <input
                id="biz-name"
                type="text"
                placeholder="e.g. Temi's Kitchen, TechDrops UNILAG"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                maxLength={60}
                required
                className={inp}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="biz-cat" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Primary Category <span className="text-red-500">*</span>
              </label>
              <select
                id="biz-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inp}
                required
              >
                <option value="">Select a category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Pickup location */}
            <div>
              <label htmlFor="pickup" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Campus Pickup Location
              </label>
              <select
                id="pickup"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className={inp}
              >
                <option value="">Select a spot (optional)</option>
                {PICKUP_SPOTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Where buyers can collect from you on campus</p>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="biz-bio" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Short Bio <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="biz-bio"
                rows={2}
                placeholder="Describe what you sell in 1–2 sentences…"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                className={`${inp} resize-none`}
              />
              <p className="text-[11px] text-gray-400 mt-1">{bio.length}/160</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-400 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity shadow-md shadow-brand-500/20 mt-2"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <>Create My Store <ChevronRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-5">
          Already a seller?{" "}
          <Link href="/seller" className="text-brand-500 hover:underline font-medium">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
