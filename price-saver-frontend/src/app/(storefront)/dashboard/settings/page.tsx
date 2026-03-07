"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi, uploadApi } from "@/lib/api";
import { Camera, Check, Mail } from "lucide-react";

const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5";
const INPUT = "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] text-gray-800 dark:text-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors";

const LEVELS = ["100L", "200L", "300L", "400L", "500L", "Postgrad", "PhD"];

export default function ProfileSettingsPage() {
  const { user, token, refreshUser } = useAuth();

  const [displayName, setDisplayName]   = useState(user?.display_name || "");
  const [phone, setPhone]               = useState(user?.phone || "");
  const [department, setDepartment]     = useState(user?.department || "");
  const [level, setLevel]               = useState(user?.level || "");
  const [saving, setSaving]             = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  // Avatar upload
  const avatarRef = useRef<HTMLInputElement>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);

  // Email OTP
  const [otp, setOtp]               = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent]       = useState(false);
  const [otpError, setOtpError]     = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [cooldown, setCooldown]     = useState(0);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setPhone(user.phone || "");
      setDepartment(user.department || "");
      setLevel(user.level || "");
      setAvatarPreview(user.avatar_url || null);
    }
  }, [user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await authApi.updateProfile(token, {
        display_name: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        level: level || undefined,
      });
      setSaveSuccess(true);
      if (refreshUser) await refreshUser();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarLoading(true);
    try {
      await uploadApi.uploadAvatar(token, file);
      if (refreshUser) await refreshUser();
    } catch {
      setAvatarPreview(user?.avatar_url || null);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!token || !user?.email || cooldown > 0) return;
    setSendingOtp(true);
    setOtpError(null);
    try {
      await authApi.sendOtp(token, user.email);
      setOtpSent(true);
      setCooldown(60);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user?.email) return;
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      await authApi.verifyOtp(token, user.email, otp.trim());
      setOtpSuccess(true);
      setOtpSent(false);
      setOtp("");
      if (refreshUser) await refreshUser();
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Incorrect code. Try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const initials = (user?.display_name || user?.username || "U")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Profile Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your personal information</p>
      </div>

      {/* Avatar + name header */}
      <div className={CARD}>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white font-black text-2xl">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <button
              type="button"
              title="Change photo"
              onClick={() => avatarRef.current?.click()}
              disabled={avatarLoading}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-md hover:bg-brand-600 transition-colors disabled:opacity-60"
            >
              {avatarLoading ? (
                <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : <Camera size={13} />}
            </button>
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="font-bold text-[17px] text-gray-800 dark:text-white">{user?.display_name || user?.username}</p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
            <p className="text-[12px] text-gray-400 mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave}>
        <div className={CARD + " space-y-4"}>
          <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white">Personal Details</h3>

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-sm text-success-700 dark:text-success-400">
              <Check size={14} /> Profile updated successfully!
            </div>
          )}
          {saveError && (
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-sm text-error-600 dark:text-error-400">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Department / Faculty</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science, Law..."
                className={INPUT}
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT}>
                <option value="">Select level…</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Email verification */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white">Email Verification</h3>
          {(user?.email_verified || otpSuccess) ? (
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-500/10 px-2.5 py-1 rounded-full">
              <Check size={11} /> Verified
            </span>
          ) : (
            <span className="text-[12px] font-bold text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-500/10 px-2.5 py-1 rounded-full">
              Unverified
            </span>
          )}
        </div>

        {(user?.email_verified || otpSuccess) ? (
          <div className="flex items-center gap-3 text-[13px] text-gray-500 dark:text-gray-400">
            <Mail size={15} />
            <span>{user?.email} is verified</span>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              Verify <strong>{user?.email}</strong> to secure your account.
            </p>
            {otpError && (
              <p className="text-[12px] text-error-600 dark:text-error-400">{otpError}</p>
            )}
            {otpSent ? (
              <form onSubmit={handleVerifyOtp} className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] text-gray-800 dark:text-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 text-center tracking-widest font-bold"
                />
                <button
                  type="submit"
                  disabled={verifyingOtp || otp.length < 6}
                  className="bg-brand-500 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-600 transition-colors disabled:opacity-60"
                >
                  {verifyingOtp ? "…" : "Verify"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || cooldown > 0}
                className="inline-flex items-center gap-2 border border-brand-200 dark:border-brand-700 text-brand-600 dark:text-brand-400 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors disabled:opacity-60"
              >
                <Mail size={14} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : sendingOtp ? "Sending…" : "Send Verification Code"}
              </button>
            )}
            {otpSent && cooldown > 0 && (
              <p className="text-[11px] text-gray-400">Didn&apos;t get it? Resend in {cooldown}s</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
