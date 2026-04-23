"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, Lock, Bell, Eye, Palette, AlertTriangle, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authApi, uploadApi, userApi } from "@/lib/api";
import { settingsApi } from "@/lib/settingsApi";

type Section = "profile" | "security" | "notifications" | "privacy" | "appearance" | "danger";
type NavItem = { id: Section; label: string; Icon: LucideIcon; danger?: boolean };

interface NotifPrefs {
  msg_email: boolean; msg_push: boolean;
  price_email: boolean; price_push: boolean;
  follow_email: boolean; follow_push: boolean;
  order_email: boolean; order_push: boolean;
  review_email: boolean; review_push: boolean;
  weekly_email: boolean; weekly_push: boolean;
  announce_email: boolean; announce_push: boolean;
}

interface PrivacyPrefs {
  profile_visibility: "public" | "unilag" | "private";
  show_dept: boolean;
  read_receipts: boolean;
}

// ── Small reusable UI pieces ──────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-semibold transition-all ${type === "success" ? "bg-green-500" : "bg-red-500"}`}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      {message}
      <button onClick={onClose} title="Dismiss notification" className="ml-2 opacity-70 hover:opacity-100">×</button>
    </div>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
      aria-label={value ? "Enabled — click to disable" : "Disabled — click to enable"}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${value ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-60 transition-all">
      {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : "✓"}
      {loading ? "Saving..." : "Save Changes"}
    </button>
  );
}

function Card({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="font-bold text-gray-900 dark:text-white text-[15px]">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">{footer}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{children}</label>;
}

function Input({ label, value, onChange, type = "text", placeholder, hint, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; readOnly?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-4">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input type={type === "password" && show ? "text" : type} value={value}
          onChange={e => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly}
          className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors read-only:bg-gray-50 dark:read-only:bg-gray-800 read-only:text-gray-400" />
        {type === "password" && (
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function NotifRow({ label, sub, emailVal, pushVal, onEmail, onPush, last }: {
  label: string; sub?: string; emailVal: boolean; pushVal: boolean;
  onEmail: (v: boolean) => void; onPush: (v: boolean) => void; last?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[1fr_72px_72px] items-center gap-3 py-3 ${!last ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="flex justify-center"><Toggle value={emailVal} onChange={onEmail} /></div>
      <div className="flex justify-center"><Toggle value={pushVal} onChange={onPush} /></div>
    </div>
  );
}

function pwStrength(pw: string): { label: string; color: string; pct: number } {
  if (!pw) return { label: "", color: "", pct: 0 };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", pct: 25 };
  if (score === 2) return { label: "Fair", color: "bg-yellow-500", pct: 50 };
  if (score === 3) return { label: "Strong", color: "bg-green-500", pct: 75 };
  return { label: "Very Strong", color: "bg-green-600", pct: 100 };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BuyerSettingsPage() {
  const { user, token, logout, refreshUser } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [active, setActive] = useState<Section>("profile");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Profile state
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [level, setLevel] = useState(user?.level || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Email OTP state
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Security
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [sessions, setSessions] = useState<{ id: string; device: string; location: string; last_active: string; current: boolean }[]>([]);

  // Notifications
  const [notifs, setNotifs] = useState<NotifPrefs>({
    msg_email: true, msg_push: true,
    price_email: true, price_push: false,
    follow_email: false, follow_push: true,
    order_email: true, order_push: true,
    review_email: true, review_push: false,
    weekly_email: true, weekly_push: false,
    announce_email: true, announce_push: true,
  });

  // Privacy
  const [privacy, setPrivacy] = useState<PrivacyPrefs>({
    profile_visibility: "unilag",
    show_dept: true,
    read_receipts: true,
  });

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);

  // Delete account
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const settingsVersionRef = useRef(1);
  const notifsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privacyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSaveNotifs = useCallback((prefs: NotifPrefs) => {
    if (notifsDebounceRef.current) clearTimeout(notifsDebounceRef.current);
    notifsDebounceRef.current = setTimeout(() => {
      settingsApi.patchSettings(token!, {
        notifications: {
          email: {
            messages:       prefs.msg_email,
            price_drop:     prefs.price_email,
            new_listing:    prefs.follow_email,
            order_update:   prefs.order_email,
            review:         prefs.review_email,
            weekly_digest:  prefs.weekly_email,
            announcements:  prefs.announce_email,
          },
          push: {
            messages:       prefs.msg_push,
            price_drop:     prefs.price_push,
            new_listing:    prefs.follow_push,
            order_update:   prefs.order_push,
            review:         prefs.review_push,
            announcements:  prefs.announce_push,
          },
        },
        client_version: settingsVersionRef.current,
      }).then(res => {
        settingsVersionRef.current = res.settings.version;
      }).catch(() => {});
    }, 600);
  }, [token]);

  const debouncedSavePrivacy = useCallback((prefs: PrivacyPrefs) => {
    if (privacyDebounceRef.current) clearTimeout(privacyDebounceRef.current);
    privacyDebounceRef.current = setTimeout(() => {
      settingsApi.patchSettings(token!, {
        profile_visibility: prefs.profile_visibility,
        show_dept:          prefs.show_dept,
        read_receipts:      prefs.read_receipts,
        client_version:     settingsVersionRef.current,
      }).then(res => {
        settingsVersionRef.current = res.settings.version;
      }).catch(() => {});
    }, 600);
  }, [token]);

  useEffect(() => {return () => {
    if (notifsDebounceRef.current) clearTimeout(notifsDebounceRef.current);
    if (privacyDebounceRef.current) clearTimeout(privacyDebounceRef.current);
  };}, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setPhone(user.phone || "");
      setDepartment(user.department || "");
      setLevel(user.level || "");
      setAvatarPreview(user.avatar_url || "");
    }
    const saved = localStorage.getItem("campify_dark");
    if (saved) setDarkMode(saved === "true");
  }, [user]);

  useEffect(() => {
    if (!token) return;
    settingsApi.getSettings(token).then(({ settings }) => {
      settingsVersionRef.current = settings.version;
      const e = settings.notifications.email;
      const p = settings.notifications.push;
      setNotifs({
        msg_email:      e.messages,
        msg_push:       p.messages,
        price_email:    e.price_drop,
        price_push:     p.price_drop,
        follow_email:   e.new_listing,
        follow_push:    p.new_listing,
        order_email:    e.order_update,
        order_push:     p.order_update,
        review_email:   e.review,
        review_push:    p.review,
        weekly_email:   e.weekly_digest,
        weekly_push:    false,
        announce_email: e.announcements,
        announce_push:  p.announcements,
      });
      setPrivacy({
        profile_visibility: settings.profile_visibility,
        show_dept:          settings.show_dept,
        read_receipts:      settings.read_receipts,
      });
      const isDark = settings.theme === "dark";
      setDarkMode(isDark);
      localStorage.setItem("campify_dark", String(isDark));
      document.documentElement.classList.toggle("dark", isDark);
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (active === "security") fetchSessions();
  }, [active]);

  useEffect(() => {
    if (otpCooldown > 0) {
      const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpCooldown]);

  const showToast = (message: string, type: "success" | "error") => setToast({ message, type });
  const setLoad = (key: string, val: boolean) => setLoading(p => ({ ...p, [key]: val }));

  async function fetchSessions() {
    try {
      const data = await authApi.getSessions(token!);
      setSessions(data.sessions || []);
    } catch { /* silent */ }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function saveProfile() {
    setLoad("profile", true);
    try {
      let avatar_url = avatarPreview;
      if (avatarFile) {
        avatar_url = await uploadApi.uploadAvatar(token!, avatarFile);
      }
      await authApi.updateProfile(token!, { display_name: displayName, phone, department, level, avatar_url });
      await refreshUser();
      showToast("Profile updated successfully", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to update profile", "error");
    } finally {
      setLoad("profile", false);
    }
  }

  async function sendOtp() {
    if (!newEmail) return showToast("Enter a new email first", "error");
    setLoad("otp", true);
    try {
      await authApi.sendOtp(token!, newEmail);
      setOtpSent(true);
      setOtpCooldown(60);
      showToast("OTP sent to " + newEmail, "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to send OTP", "error");
    } finally {
      setLoad("otp", false);
    }
  }

  async function verifyEmail() {
    if (!otp) return showToast("Enter the OTP code", "error");
    setLoad("email", true);
    try {
      await authApi.verifyOtp(token!, newEmail, otp);
      await refreshUser();
      setOtpSent(false);
      setOtp("");
      setNewEmail("");
      showToast("Email updated successfully", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Invalid OTP", "error");
    } finally {
      setLoad("email", false);
    }
  }

  async function changePassword() {
    if (!currentPw || !newPw || !confirmPw) return showToast("Fill in all password fields", "error");
    if (newPw !== confirmPw) return showToast("New passwords don't match", "error");
    if (newPw.length < 8) return showToast("Password must be at least 8 characters", "error");
    setLoad("password", true);
    try {
      await authApi.changePassword(token!, { current_password: currentPw, new_password: newPw });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      showToast("Password changed successfully", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to change password", "error");
    } finally {
      setLoad("password", false);
    }
  }

  async function revokeSession(id: string) {
    setLoad(`session_${id}`, true);
    try {
      await authApi.revokeSession(token!, id);
      setSessions(s => s.filter(x => x.id !== id));
      showToast("Session revoked", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to revoke session", "error");
    } finally {
      setLoad(`session_${id}`, false);
    }
  }

  async function saveNotifications() {
    setLoad("notifs", true);
    try {
      const res = await settingsApi.patchSettings(token!, {
        notifications: {
          email: {
            messages:       notifs.msg_email,
            price_drop:     notifs.price_email,
            new_listing:    notifs.follow_email,
            order_update:   notifs.order_email,
            review:         notifs.review_email,
            weekly_digest:  notifs.weekly_email,
            announcements:  notifs.announce_email,
          },
          push: {
            messages:       notifs.msg_push,
            price_drop:     notifs.price_push,
            new_listing:    notifs.follow_push,
            order_update:   notifs.order_push,
            review:         notifs.review_push,
            announcements:  notifs.announce_push,
          },
        },
        client_version: settingsVersionRef.current,
      });
      settingsVersionRef.current = res.settings.version;
      showToast("Notification preferences saved", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to save preferences", "error");
    } finally {
      setLoad("notifs", false);
    }
  }

  async function savePrivacy() {
    setLoad("privacy", true);
    try {
      const res = await settingsApi.patchSettings(token!, {
        profile_visibility: privacy.profile_visibility,
        show_dept:          privacy.show_dept,
        read_receipts:      privacy.read_receipts,
        client_version:     settingsVersionRef.current,
      });
      settingsVersionRef.current = res.settings.version;
      showToast("Privacy settings saved", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to save privacy settings", "error");
    } finally {
      setLoad("privacy", false);
    }
  }

  function toggleDarkMode(val: boolean) {
    setDarkMode(val);
    localStorage.setItem("campify_dark", String(val));
    document.documentElement.classList.toggle("dark", val);
    if (token) {
      settingsApi.patchSettings(token, { theme: val ? "dark" : "light" }).then(res => {
        settingsVersionRef.current = res.settings.version;
      }).catch(() => {});
    }
  }

  async function deleteAccount() {
    if (deleteInput !== "DELETE") return;
    setLoad("delete", true);
    try {
      await userApi.deleteAccount(token!);
      logout();
      router.push("/");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to delete account", "error");
    } finally {
      setLoad("delete", false);
    }
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showToast("Image must be under 2MB", "error");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  const navItems: NavItem[] = [
    { id: "profile",       label: "Profile",       Icon: User },
    { id: "security",      label: "Security",      Icon: Lock },
    { id: "notifications", label: "Notifications", Icon: Bell },
    { id: "privacy",       label: "Privacy",       Icon: Eye },
    { id: "appearance",    label: "Appearance",    Icon: Palette },
    { id: "danger",        label: "Danger Zone",   Icon: AlertTriangle, danger: true },
  ];

  const strength = pwStrength(newPw);

  return (
    <div className="space-y-0">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 flex-shrink-0 hidden lg:block">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden sticky top-4">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg mx-auto mb-2 overflow-hidden">
                {avatarPreview
                  ? <Image src={avatarPreview} alt="avatar" width={48} height={48} className="w-full h-full object-cover" />
                  : (user?.display_name?.[0] || user?.username?.[0] || "U").toUpperCase()}
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{user?.display_name || user?.username}</p>
              <p className="text-xs text-gray-400">{user?.department || "Student"}</p>
            </div>
            <nav className="p-2">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left mb-0.5
                    ${active === item.id
                      ? item.danger ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"
                                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                      : item.danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                  <item.Icon size={15} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile nav */}
        <div className="lg:hidden w-full overflow-x-auto pb-2 mb-2">
          <div className="flex gap-2">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActive(item.id)}
                className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${active === item.id ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
                <item.Icon size={12} /> {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {navItems.find(n => n.id === active)?.label}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {active === "profile" && "How you appear to sellers and the community"}
              {active === "security" && "Keep your account safe and secure"}
              {active === "notifications" && "Control exactly what you hear about and how"}
              {active === "privacy" && "Control who can see your information"}
              {active === "appearance" && "Personalise how the platform looks"}
              {active === "danger" && "Irreversible actions — read carefully before proceeding"}
            </p>
          </div>

          {/* PROFILE */}
          {active === "profile" && (
            <>
              <Card title="Profile Photo" subtitle="Your avatar across the platform">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0">
                    {avatarPreview
                      ? <Image src={avatarPreview} alt="avatar" width={64} height={64} className="w-full h-full object-cover" />
                      : (user?.display_name?.[0] || "U").toUpperCase()}
                  </div>
                  <div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                    <button onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all">
                      ↑ Upload New Photo
                    </button>
                    <p className="text-xs text-gray-400 mt-1.5">JPG or PNG · Max 2MB</p>
                  </div>
                </div>
              </Card>

              <Card title="Personal Information" subtitle="Basic details visible on your profile"
                footer={<SaveButton loading={loading.profile} onClick={saveProfile} />}>
                <div className="grid grid-cols-2 gap-x-4">
                  <Input label="Display Name" value={displayName} onChange={setDisplayName} />
                  <Input label="Username" value={user?.username || ""} readOnly hint="Username cannot be changed" />
                  <Input label="Department" value={department} onChange={setDepartment} placeholder="e.g. Computer Science" />
                  <div className="mb-4">
                    <FieldLabel>Level</FieldLabel>
                    <select value={level} onChange={e => setLevel(e.target.value)}
                      className="w-full bg-white dark:bg-gray-900 dark:[color-scheme:dark] border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors">
                      <option value="">Select level</option>
                      {["100", "200", "300", "400", "500", "600", "700"].map(l =>
                        <option key={l} value={l}>{l} Level</option>)}
                    </select>
                  </div>
                </div>
                <Input label="Phone Number" value={phone} onChange={setPhone} placeholder="e.g. 08012345678" hint="Used for account recovery only · Not shown publicly" />
              </Card>

              <Card title="Change Email Address" subtitle="Requires OTP confirmation on your new email">
                <Input label="New Email Address" value={newEmail} onChange={setNewEmail} placeholder="newemail@example.com" />
                {otpSent && (
                  <Input label="OTP Code" value={otp} onChange={setOtp} placeholder="Enter 6-digit code" hint={`Sent to ${newEmail}`} />
                )}
                <div className="flex gap-3 mt-1">
                  {!otpSent ? (
                    <button onClick={sendOtp} disabled={loading.otp || !newEmail}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
                      {loading.otp && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                      Send OTP
                    </button>
                  ) : (
                    <>
                      <button onClick={verifyEmail} disabled={loading.email || !otp}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all">
                        {loading.email && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                        Verify & Update
                      </button>
                      <button onClick={sendOtp} disabled={loading.otp || otpCooldown > 0}
                        className="px-4 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all">
                        {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend OTP"}
                      </button>
                    </>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* SECURITY */}
          {active === "security" && (
            <>
              <Card title="Change Password" footer={<SaveButton loading={loading.password} onClick={changePassword} />}>
                <Input label="Current Password" value={currentPw} onChange={setCurrentPw} type="password" placeholder="Current password" />
                <Input label="New Password" value={newPw} onChange={setNewPw} type="password" placeholder="Min. 8 characters" />
                {newPw && (
                  <div className="mb-4 -mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`flex-1 h-1 rounded-full transition-all ${(strength.pct / 25) >= i ? strength.color : "bg-gray-200 dark:bg-gray-700"}`} />
                      ))}
                    </div>
                    {strength.label && <p className={`text-xs font-semibold text-${strength.color.replace("bg-", "")}`}>{strength.label}</p>}
                  </div>
                )}
                <Input label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Repeat new password" />
                {confirmPw && newPw !== confirmPw && (
                  <p className="text-xs text-red-500 -mt-3 mb-3">Passwords don&apos;t match</p>
                )}
              </Card>

              <Card title="Active Sessions" subtitle="Devices currently logged into your account">
                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No additional sessions found</p>
                ) : sessions.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-3 py-3.5 ${i < sessions.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 text-lg flex-shrink-0">💻</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.device}</span>
                        {s.current && <span className="text-[10px] font-bold bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Current</span>}
                      </div>
                      <p className="text-xs text-gray-400">{s.location} · {s.last_active}</p>
                    </div>
                    {!s.current && (
                      <button onClick={() => revokeSession(s.id)} disabled={loading[`session_${s.id}`]}
                        className="text-xs text-red-500 font-bold border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-all">
                        {loading[`session_${s.id}`] ? "..." : "Revoke"}
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            </>
          )}

          {/* NOTIFICATIONS */}
          {active === "notifications" && (
            <Card title="Notification Preferences" subtitle="Choose how you're notified for each event"
              footer={<SaveButton loading={loading.notifs} onClick={saveNotifications} />}>
              <div className="grid grid-cols-[1fr_72px_72px] gap-3 pb-2 mb-1 border-b border-gray-100 dark:border-gray-800">
                <span />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Email</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Push</span>
              </div>
              <NotifRow label="New message" sub="When a seller replies to you"
                emailVal={notifs.msg_email} pushVal={notifs.msg_push}
                onEmail={v => { const n = { ...notifs, msg_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, msg_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} />
              <NotifRow label="Price drop alert" sub="Wishlisted item drops in price"
                emailVal={notifs.price_email} pushVal={notifs.price_push}
                onEmail={v => { const n = { ...notifs, price_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, price_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} />
              <NotifRow label="New listing from followed seller"
                emailVal={notifs.follow_email} pushVal={notifs.follow_push}
                onEmail={v => { const n = { ...notifs, follow_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, follow_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} />
              <NotifRow label="Order status update"
                emailVal={notifs.order_email} pushVal={notifs.order_push}
                onEmail={v => { const n = { ...notifs, order_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, order_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} />
              <NotifRow label="Review reminder" sub="After completing a transaction"
                emailVal={notifs.review_email} pushVal={notifs.review_push}
                onEmail={v => { const n = { ...notifs, review_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, review_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} />
              <NotifRow label="Weekly deals digest" sub="Every Monday morning"
                emailVal={notifs.weekly_email} pushVal={notifs.weekly_push}
                onEmail={v => { const n = { ...notifs, weekly_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, weekly_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} />
              <NotifRow label="Platform announcements"
                emailVal={notifs.announce_email} pushVal={notifs.announce_push}
                onEmail={v => { const n = { ...notifs, announce_email: v }; setNotifs(n); debouncedSaveNotifs(n); }} onPush={v => { const n = { ...notifs, announce_push: v }; setNotifs(n); debouncedSaveNotifs(n); }} last />
            </Card>
          )}

          {/* PRIVACY */}
          {active === "privacy" && (
            <Card title="Privacy Controls" subtitle="Control who sees your information"
              footer={<SaveButton loading={loading.privacy} onClick={savePrivacy} />}>
              <div className="mb-5">
                <FieldLabel>Who can see your profile?</FieldLabel>
                <div className="space-y-2">
                  {([
                    ["public", "🌍 Everyone (Public)", "Visible to anyone"],
                    ["unilag", "🎓 UNILAG Students Only", "Only verified accounts"],
                    ["private", "🔒 Private", "Only people you message"],
                  ] as const).map(([val, label, sub]) => (
                    <label key={val} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${privacy.profile_visibility === val ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                      <input type="radio" value={val} checked={privacy.profile_visibility === val}
                        onChange={() => setPrivacy(p => ({ ...p, profile_visibility: val }))}
                        className="accent-blue-600" />
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</p>
                        <p className="text-xs text-gray-400">{sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                {[
                  { key: "show_dept" as const, label: "Show department & level on profile", sub: "Visible to other users" },
                  { key: "read_receipts" as const, label: "Read receipts", sub: "Let sellers know when you've read their message" },
                ].map(({ key, label, sub }, i, arr) => (
                  <div key={key} className={`flex justify-between items-center py-3.5 ${i < arr.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                    <Toggle value={privacy[key]} onChange={v => { const p = { ...privacy, [key]: v }; setPrivacy(p); debouncedSavePrivacy(p); }} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* APPEARANCE */}
          {active === "appearance" && (
            <Card title="Theme" subtitle="Personalise how the platform looks for you">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["light", "☀️", "Light Mode", "Clean white & blue interface"],
                  ["dark", "🌙", "Dark Mode", "Easy on the eyes at night"],
                ] as const).map(([val, icon, label, sub]) => (
                  <div key={val} onClick={() => toggleDarkMode(val === "dark")}
                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 cursor-pointer transition-all ${(val === "dark") === darkMode ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                    <span className="text-3xl">{icon}</span>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-400 text-center">{sub}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* DANGER ZONE */}
          {active === "danger" && (
            <div className="bg-white dark:bg-gray-900 border-2 border-red-200 dark:border-red-900 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-red-100 dark:border-red-900 flex items-center gap-2">
                <span className="text-red-500">⚠️</span>
                <h3 className="font-bold text-red-600 dark:text-red-400 text-[15px]">Delete Account Permanently</h3>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will permanently delete your account, all saved wishlists, messages, and data.
                  This action <strong>cannot be undone</strong>.
                </p>
                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-bold hover:bg-red-100 transition-all">
                    I want to delete my account
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 font-semibold mb-3">Type <strong>DELETE</strong> to confirm</p>
                    <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type DELETE here..."
                      className="w-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-700 rounded-xl px-3.5 py-2.5 text-sm mb-3 focus:outline-none focus:border-red-500 transition-colors" />
                    <div className="flex gap-2">
                      <button onClick={deleteAccount} disabled={deleteInput !== "DELETE" || loading.delete}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-40 transition-all">
                        {loading.delete && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                        Delete Forever
                      </button>
                      <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                        className="px-4 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
