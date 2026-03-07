"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";

export default function SellerProfilePage() {
  const { user, token } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await sellerApi.updateProfile(token, {
        display_name: displayName || undefined,
        email: email || undefined,
      });
      setSuccess("Profile updated successfully!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Profile card */}
      <div className="col-span-12 xl:col-span-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center text-white text-3xl font-bold mb-4">
              {user?.username?.charAt(0).toUpperCase() ?? "S"}
            </div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {user?.display_name || user?.username}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
            {user?.email && (
              <p className="text-xs text-gray-400 mt-1">{user.email}</p>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Username</span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90 capitalize">{user?.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Points</span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">{user?.balance ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="col-span-12 xl:col-span-7">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">Edit Profile</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Update your store information</p>

          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success-50 border border-success-200 dark:bg-success-500/10 dark:border-success-500/20">
              <p className="text-sm text-success-600 dark:text-success-400">{success}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-error-50 border border-error-200 dark:bg-error-500/10 dark:border-error-500/20">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Display / Store Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your store name"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seller@unilag.edu.ng"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                type="text"
                value={user?.username || ""}
                disabled
                className={`${inputCls} opacity-50 cursor-not-allowed`}
              />
              <p className="mt-1 text-xs text-gray-400">Username cannot be changed</p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
