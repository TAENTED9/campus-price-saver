"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";

export default function AdminSignInPage() {
  const router = useRouter();
  const { login } = useAdminAuth();

  const [username, setUsername] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) { setError("Username is required."); return; }
    if (!adminKey.trim()) { setError("Admin key is required."); return; }

    setIsLoading(true);
    try {
      await login(username.trim(), adminKey.trim());
      router.push("/admin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand-600 overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">PS</span>
            </div>
            <div>
              <p className="font-bold text-lg">Price Saver</p>
              <p className="text-brand-200 text-xs">Admin Dashboard</p>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-bold mb-4">Platform<br />Command Centre</h2>
            <p className="text-brand-100 text-lg mb-8">
              Manage sellers, listings, verifications, and platform health — all from one place.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { v: "Seller Verification", d: "Review & approve campus sellers" },
                { v: "Listing Moderation", d: "Flag & remove bad content" },
                { v: "User Management", d: "Buyers, sellers & roles" },
                { v: "Analytics", d: "Platform-wide insights" },
              ].map((f) => (
                <div key={f.v} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <p className="font-semibold text-sm">{f.v}</p>
                  <p className="text-brand-200 text-xs mt-1">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-brand-300 text-sm">© {new Date().getFullYear()} Price Saver · Admin Portal</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col flex-1 px-6 py-8 sm:px-12 lg:px-16 items-center justify-center">
        <div className="w-full max-w-md">
          {/* Back to storefront */}
          <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            Back to storefront
          </Link>

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Admin Access Only</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90 mb-1">Admin Sign In</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your admin username and secret key.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-error-50 border border-error-200 dark:bg-error-500/10 dark:border-error-500/20">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400" htmlFor="username">
                Admin Username <span className="text-red-500">*</span>
              </label>
              <input
                id="username" type="text" required
                placeholder="Enter admin username"
                value={username} onChange={(e) => setUsername(e.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400" htmlFor="adminKey">
                Admin Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="adminKey" required
                  type={showKey ? "text" : "password"}
                  placeholder="Enter your secret admin key"
                  value={adminKey} onChange={(e) => setAdminKey(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-12 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10 focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <button type="button" onClick={() => setShowKey(!showKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                This is <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ADMIN_API_KEY</code> from your backend <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env</code>
              </p>
            </div>

            <button
              type="submit" disabled={isLoading}
              className="w-full inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="mt-6 p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-white/[0.02] dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              🔒 Administrators only. Unauthorized attempts are logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
