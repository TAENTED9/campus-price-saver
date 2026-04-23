"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Store, Shield, FileText, MapPin, List, Lock, Bell, AlertTriangle, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, authApi, userApi, uploadApi } from "@/lib/api";
import { settingsApi } from "@/lib/settingsApi";

type Section =
  | "business"
  | "verification"
  | "policies"
  | "availability"
  | "defaults"
  | "security"
  | "notifications"
  | "danger";

type NavItem = { id: Section; label: string; Icon: LucideIcon; danger?: boolean };

interface SellerNotifs {
  inquiry_email: boolean; inquiry_push: boolean;
  review_email: boolean; review_push: boolean;
  follower_email: boolean; follower_push: boolean;
  expiry_email: boolean; expiry_push: boolean;
  verif_email: boolean; verif_push: boolean;
  competitor_email: boolean; competitor_push: boolean;
  karma_email: boolean; karma_push: boolean;
  weekly_email: boolean; weekly_push: boolean;
}

// ── Reusable UI pieces ─────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-semibold ${type === "success" ? "bg-green-500" : "bg-red-500"}`}>
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

function Input({ label, value, onChange, type = "text", placeholder, hint, readOnly, suffix }: {
  label: string; value: string; onChange?: (v: string) => void; type?: string;
  placeholder?: string; hint?: string; readOnly?: boolean; suffix?: string;
}) {
  return (
    <div className="mb-4">
      <FieldLabel>{label}</FieldLabel>
      <div className="relative flex items-center">
        <input type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly}
          className={`w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors read-only:bg-gray-50 dark:read-only:bg-gray-800 read-only:text-gray-400${suffix ? " pr-20" : ""}`} />
        {suffix && <span className="absolute right-3 text-xs text-gray-400 font-semibold">{suffix}</span>}
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

// ────────────────────────────────────────────────────────────────────────────

export default function SellerSettingsPage() {
  const { user, token, logout, refreshUser } = useAuth();
  const router = useRouter();
  const bannerRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [active, setActive] = useState<Section>("business");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Business profile
  const [bizName, setBizName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showWhatsapp, setShowWhatsapp] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [logoPreview, setLogoPreview] = useState(user?.avatar_url || "");

  // Verification
  const [verifStatus, setVerifStatus] = useState<{ status: string; reason?: string } | null>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLInputElement>(null);

  // Policies
  const [pickupPolicy, setPickupPolicy] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [paymentPolicy, setPaymentPolicy] = useState("");

  // Availability
  const [storeStatus, setStoreStatus] = useState<"open" | "limited" | "closed">("open");
  const [vacationMode, setVacationMode] = useState(false);
  const [vacationDate, setVacationDate] = useState("");
  const [autoReply, setAutoReply] = useState("Hi! I'm currently unavailable. I'll reply as soon as possible.");
  const [showVacationConfirm, setShowVacationConfirm] = useState(false);
  const [pendingVacation, setPendingVacation] = useState(false);

  // Defaults
  const [defaultLocation, setDefaultLocation] = useState("");
  const [defaultDuration, setDefaultDuration] = useState("14");
  const [autoRenew, setAutoRenew] = useState(true);
  const [defaultNegotiable, setDefaultNegotiable] = useState(false);

  // Security
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [sessions, setSessions] = useState<{ id: string; device: string; location: string; last_active: string; current: boolean }[]>([]);

  // Notifications
  const [notifs, setNotifs] = useState<SellerNotifs>({
    inquiry_email: true, inquiry_push: true,
    review_email: true, review_push: true,
    follower_email: false, follower_push: true,
    expiry_email: true, expiry_push: false,
    verif_email: true, verif_push: true,
    competitor_email: false, competitor_push: true,
    karma_email: false, karma_push: true,
    weekly_email: true, weekly_push: false,
  });

  // Danger
  const [deleteInput, setDeleteInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const settingsVersionRef = useRef(1);
  const showToast = (message: string, type: "success" | "error") => setToast({ message, type });
  const setLoad = (key: string, val: boolean) => setLoading(p => ({ ...p, [key]: val }));

  useEffect(() => {
    fetchProfile();
    fetchVerifStatus();
    if (token) {
      settingsApi.getSettings(token).then(({ settings }) => {
        settingsVersionRef.current = settings.version;
        setStoreStatus(settings.store_status);
        setVacationMode(settings.vacation_mode);
        setVacationDate(settings.vacation_resume_date || "");
        setDefaultLocation(settings.default_pickup_location || "");
        setDefaultDuration(String(settings.default_listing_duration));
        setAutoRenew(settings.auto_renew_listings);
        setDefaultNegotiable(settings.default_negotiable);
        const e = settings.notifications.email;
        const p = settings.notifications.push;
        setNotifs({
          inquiry_email:    e.inquiry,
          inquiry_push:     p.inquiry,
          review_email:     e.review,
          review_push:      p.review,
          follower_email:   e.follower,
          follower_push:    p.follower,
          expiry_email:     e.expiry,
          expiry_push:      false,
          verif_email:      e.verification,
          verif_push:       false,
          competitor_email: e.competitor,
          competitor_push:  false,
          karma_email:      e.karma,
          karma_push:       false,
          weekly_email:     e.weekly_digest,
          weekly_push:      false,
        });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (active === "security") fetchSessions();
  }, [active]);

  // Slug availability debounce
  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await sellerApi.checkSlug(token!, slug);
        setSlugStatus(res.available ? "ok" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [slug]);

  async function fetchProfile() {
    try {
      const data = await sellerApi.getProfile(token!) as Record<string, unknown>;
      setBizName((data.display_name as string) || "");
      setSlug((data.slug as string) || "");
      setCategory((data.category as string) || "");
      setBio((data.bio as string) || "");
      setWhatsapp((data.whatsapp as string) || "");
      setShowWhatsapp((data.show_whatsapp as boolean) ?? true);
      setInstagram((data.instagram as string) || "");
      setBannerPreview((data.banner_url as string) || "");
      setLogoPreview((data.avatar_url as string) || "");
      setPickupPolicy((data.pickup_policy as string) || "");
      setReturnPolicy((data.return_policy as string) || "");
      setPaymentPolicy((data.payment_policy as string) || "");
      setStoreStatus(((data.availability_status as string) || "open") as "open" | "limited" | "closed");
      setVacationMode((data.vacation_mode as boolean) || false);
      setVacationDate((data.vacation_resume_date as string) || "");
      setAutoReply((data.auto_reply as string) || "Hi! I'm currently unavailable. I'll reply as soon as possible.");
      setDefaultLocation((data.default_location as string) || "");
      setDefaultDuration((data.default_duration as number)?.toString() || "14");
      setAutoRenew((data.auto_renew as boolean) ?? true);
      setDefaultNegotiable((data.default_negotiable as boolean) ?? false);
    } catch { /* silent on initial load */ }
  }

  async function fetchVerifStatus() {
    try {
      const res = await sellerApi.getVerification(token!);
      if (res.data) {
        const raw = (res.data.status || "").toLowerCase();
        const statusMap: Record<string, string> = {
          pending: "pending", "under review": "pending",
          approved: "verified", rejected: "rejected",
        };
        setVerifStatus({
          status: statusMap[raw] || raw,
          reason: res.data.adminNotes || undefined,
        });
      } else {
        setVerifStatus({ status: "not_submitted" });
      }
    } catch { setVerifStatus({ status: "unknown" }); }
  }

  async function fetchSessions() {
    try {
      const data = await authApi.getSessions(token!);
      setSessions(data.sessions || []);
    } catch { }
  }

  // ── Save handlers ──────────────────────────────────────────────────────

  async function saveBusinessProfile() {
    if (slugStatus === "taken") return showToast("That store URL is already taken", "error");
    setLoad("business", true);
    try {
      let banner_url = bannerPreview;
      let avatar_url = logoPreview;

      const bannerFile = bannerRef.current?.files?.[0];
      if (bannerFile) {
        banner_url = await uploadApi.uploadBanner(token!, bannerFile);
      }
      const logoFile = logoRef.current?.files?.[0];
      if (logoFile) {
        avatar_url = await uploadApi.uploadAvatar(token!, logoFile);
      }

      await sellerApi.updateStorefront(token!, {
        display_name: bizName, slug, category, bio,
        whatsapp, show_whatsapp: showWhatsapp, instagram,
        banner_url, avatar_url,
      });
      await refreshUser();
      showToast("Business profile updated", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to update profile", "error");
    } finally {
      setLoad("business", false);
    }
  }

  async function savePolicies() {
    setLoad("policies", true);
    try {
      await sellerApi.updatePolicies(token!, { pickup_policy: pickupPolicy, return_policy: returnPolicy, payment_policy: paymentPolicy });
      showToast("Store policies saved", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to save policies", "error");
    } finally {
      setLoad("policies", false);
    }
  }

  async function saveAvailability() {
    setLoad("availability", true);
    try {
      const [res] = await Promise.all([
        settingsApi.patchSettings(token!, {
          store_status:   storeStatus,
          client_version: settingsVersionRef.current,
        }),
        sellerApi.setAvailability(token!, storeStatus),
        sellerApi.updateAutoReplyMsg(token!, { message: autoReply }),
      ]);
      settingsVersionRef.current = res.settings.version;
      showToast("Availability settings saved", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to save availability", "error");
    } finally {
      setLoad("availability", false);
    }
  }

  async function handleVacationToggle(val: boolean) {
    if (val) {
      setPendingVacation(true);
      setShowVacationConfirm(true);
    } else {
      setLoad("vacation", true);
      try {
        const res = await settingsApi.patchSettings(token!, {
          vacation_mode:        false,
          vacation_resume_date: null,
          client_version:       settingsVersionRef.current,
        });
        settingsVersionRef.current = res.settings.version;
        setVacationMode(false);
        showToast("Vacation mode disabled — listings restored", "success");
      } catch (e: unknown) {
        showToast((e instanceof Error ? e.message : null) || "Failed to disable vacation mode", "error");
      } finally {
        setLoad("vacation", false);
      }
    }
  }

  async function confirmVacation() {
    setShowVacationConfirm(false);
    setLoad("vacation", true);
    try {
      const res = await settingsApi.patchSettings(token!, {
        vacation_mode:        true,
        vacation_resume_date: vacationDate || null,
        client_version:       settingsVersionRef.current,
      });
      settingsVersionRef.current = res.settings.version;
      setVacationMode(true);
      setPendingVacation(false);
      showToast("Vacation mode enabled — all listings paused", "success");
    } catch (e: unknown) {
      setPendingVacation(false);
      showToast((e instanceof Error ? e.message : null) || "Failed to enable vacation mode", "error");
    } finally {
      setLoad("vacation", false);
    }
  }

  async function saveDefaults() {
    setLoad("defaults", true);
    try {
      const res = await settingsApi.patchSettings(token!, {
        default_pickup_location:  defaultLocation || null,
        default_listing_duration: parseInt(defaultDuration) as 7 | 14 | 30,
        auto_renew_listings:      autoRenew,
        default_negotiable:       defaultNegotiable,
        client_version:           settingsVersionRef.current,
      });
      settingsVersionRef.current = res.settings.version;
      showToast("Listing defaults saved", "success");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to save defaults", "error");
    } finally {
      setLoad("defaults", false);
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
      showToast("Password changed", "success");
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
      showToast((e instanceof Error ? e.message : null) || "Failed to revoke", "error");
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
            inquiry:      notifs.inquiry_email,
            review:       notifs.review_email,
            follower:     notifs.follower_email,
            expiry:       notifs.expiry_email,
            verification: notifs.verif_email,
            competitor:   notifs.competitor_email,
            karma:        notifs.karma_email,
            weekly_digest: notifs.weekly_email,
          },
          push: {
            inquiry:  notifs.inquiry_push,
            review:   notifs.review_push,
            follower: notifs.follower_push,
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

  async function downgradeTobuyer() {
    setLoad("downgrade", true);
    try {
      await sellerApi.downgrade(token!);
      await refreshUser();
      showToast("Downgraded to Buyer account", "success");
      router.push("/dashboard");
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || "Failed to downgrade", "error");
    } finally {
      setLoad("downgrade", false);
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

  const navItems: NavItem[] = [
    { id: "business",      label: "Business Profile", Icon: Store },
    { id: "verification", label: "Verification",      Icon: Shield },
    { id: "policies",     label: "Store Policies",   Icon: FileText },
    { id: "availability", label: "Availability",     Icon: MapPin },
    { id: "defaults",     label: "Listing Defaults", Icon: List },
    { id: "security",     label: "Security",         Icon: Lock },
    { id: "notifications",label: "Notifications",    Icon: Bell },
    { id: "danger",       label: "Danger Zone",      Icon: AlertTriangle, danger: true },
  ];

  const CATEGORIES = ["Tech Accessories", "Food & Drinks", "Fashion", "Books & Stationery", "Beauty & Skincare", "Services", "Handmade & Crafts", "Hostel Items", "Other"];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Vacation confirm modal */}
      {showVacationConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-3xl mb-3">🏖️</div>
            <h3 className="font-black text-lg text-gray-900 dark:text-white mb-2">Enable Vacation Mode?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              All your active listings will be <strong>hidden from buyers</strong> until you return. Existing conversations won&apos;t be affected.
            </p>
            <div className="mb-4">
              <FieldLabel>Auto-resume date (optional)</FieldLabel>
              <input type="date" value={vacationDate} onChange={e => setVacationDate(e.target.value)}
                className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors text-gray-900 dark:text-white" />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmVacation} disabled={loading.vacation}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
                {loading.vacation && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Yes, Enable
              </button>
              <button onClick={() => { setShowVacationConfirm(false); setPendingVacation(false); }}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-6">

        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden sticky top-24">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg mx-auto mb-2 overflow-hidden">
                {logoPreview
                  ? <Image src={logoPreview} alt="logo" width={48} height={48} className="w-full h-full object-cover" />
                  : (bizName?.[0] || "S").toUpperCase()}
              </div>
              <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{bizName || user?.display_name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                  {user?.role === "seller" ? "✓ SELLER" : "PENDING"}
                </span>
              </div>
            </div>
            <nav className="p-2">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left mb-0.5
                    ${active === item.id
                      ? item.danger ? "bg-red-50 dark:bg-red-950 text-red-600 border-l-[3px] border-red-500"
                                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-l-[3px] border-blue-500"
                      : item.danger ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 border-l-[3px] border-transparent"
                                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-[3px] border-transparent"}`}>
                  <item.Icon size={15} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {navItems.find(n => n.id === active)?.label}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {active === "business" && "Your public storefront — make it count"}
              {active === "verification" && "Your UNILAG student verification status"}
              {active === "policies" && "Shown publicly on your storefront — be clear and honest"}
              {active === "availability" && "Let buyers know when you're open for business"}
              {active === "defaults" && "Pre-fill these values every time you create a new listing"}
              {active === "security" && "Keep your seller account safe"}
              {active === "notifications" && "Control what buyer activity you're notified about"}
              {active === "danger" && "Irreversible actions — read carefully"}
            </p>
          </div>

          {/* BUSINESS PROFILE */}
          {active === "business" && (
            <Card title="Store Branding" subtitle="Logo and banner shown on your storefront"
              footer={<SaveButton loading={loading.business} onClick={saveBusinessProfile} />}>
              {/* Banner */}
              <div className="mb-5">
                <FieldLabel>Store Banner</FieldLabel>
                <div onClick={() => bannerRef.current?.click()}
                  className="h-24 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden relative">
                  {bannerPreview
                    ? <Image src={bannerPreview} alt="banner" fill className="object-cover" />
                    : <span className="text-sm text-gray-400">↑ Upload Banner (1200×300 recommended)</span>}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setBannerPreview(URL.createObjectURL(f)); }} />
              </div>
              {/* Logo */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl overflow-hidden flex-shrink-0">
                  {logoPreview ? <Image src={logoPreview} alt="logo" width={64} height={64} className="w-full h-full object-cover" /> : (bizName?.[0] || "S").toUpperCase()}
                </div>
                <div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setLogoPreview(URL.createObjectURL(f)); }} />
                  <button onClick={() => logoRef.current?.click()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all">
                    Change Logo
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Square image · Max 2MB</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <Input label="Business Name" value={bizName} onChange={setBizName} />
                <div className="mb-4">
                  <FieldLabel>Store URL Slug</FieldLabel>
                  <div className="relative">
                    <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="your-store-name"
                      className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors pr-8" />
                    {slugStatus === "checking" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
                    {slugStatus === "ok" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">✓</span>}
                    {slugStatus === "taken" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 font-bold">✕</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {slugStatus === "taken" ? <span className="text-red-500">URL already taken</span> : `campify.ng/store/${slug || "your-store"}`}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <FieldLabel>Business Bio</FieldLabel>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                  className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  placeholder="Describe your store in a few lines..." />
                <p className="text-[11px] text-gray-400 mt-1">{bio.length}/300</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <div className="mb-4">
                  <FieldLabel>Primary Category</FieldLabel>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full bg-white dark:bg-gray-900 dark:[color-scheme:dark] border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors">
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div />
              </div>
              <Input label="WhatsApp Number" value={whatsapp} onChange={setWhatsapp} placeholder="e.g. 08012345678" />
              <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Show WhatsApp on storefront</p>
                  <p className="text-xs text-gray-400">Shown as a tap-to-chat link</p>
                </div>
                <Toggle value={showWhatsapp} onChange={setShowWhatsapp} />
              </div>
              <div className="pt-4">
                <Input label="Instagram Handle" value={instagram} onChange={setInstagram} placeholder="username (no @)" />
              </div>
            </Card>
          )}

          {/* VERIFICATION */}
          {active === "verification" && (
            <Card title="Verification Status" subtitle="Your UNILAG student verification documents">
              {verifStatus && (
                <div className={`flex items-center gap-4 p-4 rounded-xl mb-5 border ${
                  verifStatus.status === "verified" ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" :
                  verifStatus.status === "pending" ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" :
                  "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${
                    verifStatus.status === "verified" ? "bg-green-500" :
                    verifStatus.status === "pending" ? "bg-yellow-500" : "bg-red-500"
                  }`}>
                    {verifStatus.status === "verified" ? "✓" : verifStatus.status === "pending" ? "⏳" : "✕"}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${verifStatus.status === "verified" ? "text-green-700 dark:text-green-400" : verifStatus.status === "pending" ? "text-yellow-700 dark:text-yellow-400" : "text-red-700 dark:text-red-400"}`}>
                      {verifStatus.status === "verified" ? "Verified UNILAG Seller" : verifStatus.status === "pending" ? "Verification Pending" : "Not yet verified"}
                    </p>
                    {verifStatus.status === "rejected" && verifStatus.reason && (
                      <p className="text-xs text-red-500 mt-0.5">Reason: {verifStatus.reason}</p>
                    )}
                    {verifStatus.status === "pending" && (
                      <p className="text-xs text-yellow-600 mt-0.5">Under review · Usually within 24 hours</p>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {[
                  { label: "Student ID Card (Front)", ref: idRef, name: "id_card" },
                  { label: "Portal Screenshot (Name + Matric + Session)", ref: portalRef, name: "portal" },
                ].map(({ label, ref, name }) => (
                  <div key={name}>
                    <FieldLabel>{label}</FieldLabel>
                    <div onClick={() => ref.current?.click()}
                      className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                      <span className="text-blue-500 text-xl">↑</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Click to upload</p>
                        <p className="text-xs text-gray-400">JPG or PNG · Max 5MB</p>
                      </div>
                    </div>
                    <input ref={ref} type="file" accept="image/*" className="hidden" />
                  </div>
                ))}
                <button onClick={async () => {
                  const idFile = idRef.current?.files?.[0];
                  const portalFile = portalRef.current?.files?.[0];
                  if (!idFile || !portalFile) return showToast("Upload both documents first", "error");
                  setLoad("docs", true);
                  try {
                    const fd = new FormData();
                    fd.append("id_card", idFile);
                    fd.append("portal_screenshot", portalFile);
                    await sellerApi.submitVerificationDocs(token!, fd);
                    await fetchVerifStatus();
                    showToast("Documents submitted — under review", "success");
                  } catch (e: unknown) {
                    showToast((e instanceof Error ? e.message : null) || "Upload failed", "error");
                  } finally {
                    setLoad("docs", false);
                  }
                }} disabled={loading.docs}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all">
                  {loading.docs && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Submit Documents
                </button>
              </div>
            </Card>
          )}

          {/* POLICIES */}
          {active === "policies" && (
            <>
              {[
                { key: "pickup", label: "Pickup & Delivery Policy", val: pickupPolicy, set: setPickupPolicy, hint: "Where and when buyers can collect items" },
                { key: "return", label: "Return & Refund Policy", val: returnPolicy, set: setReturnPolicy, hint: "Your terms for returns, exchanges, or defective items" },
                { key: "payment", label: "Payment Methods", val: paymentPolicy, set: setPaymentPolicy, hint: "What payment options you accept" },
              ].map(({ key, label, val, set, hint }, i, arr) => (
                <Card key={key} title={label} subtitle={hint}
                  footer={i === arr.length - 1 ? <SaveButton loading={loading.policies} onClick={savePolicies} /> : undefined}>
                  <textarea value={val} onChange={e => set(e.target.value)} rows={4}
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder={`Enter your ${label.toLowerCase()}...`} />
                  <p className="text-[11px] text-gray-400 mt-1">{val.length}/500</p>
                </Card>
              ))}
            </>
          )}

          {/* AVAILABILITY */}
          {active === "availability" && (
            <>
              <Card title="Store Status" subtitle="Shown on your storefront to buyers"
                footer={<SaveButton loading={loading.availability} onClick={saveAvailability} />}>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {(["open", "limited", "closed"] as const).map(val => (
                    <div key={val} onClick={() => setStoreStatus(val)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${storeStatus === val ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"}`}>
                      <span className="text-2xl">{val === "open" ? "🟢" : val === "limited" ? "🟡" : "🔴"}</span>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300 capitalize">{val}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Vacation Mode" subtitle="Pause all your listings at once">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Enable Vacation Mode</p>
                    <p className="text-xs text-gray-400">All listings hidden from buyers while enabled</p>
                  </div>
                  <Toggle value={vacationMode || pendingVacation} onChange={handleVacationToggle} disabled={loading.vacation} />
                </div>
                {vacationMode && vacationDate && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                    Auto-resumes on {new Date(vacationDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                )}
              </Card>

              <Card title="Auto-Reply Message" subtitle="Sent when buyers message you while unavailable"
                footer={<SaveButton loading={loading.availability} onClick={saveAvailability} />}>
                <textarea value={autoReply} onChange={e => setAutoReply(e.target.value)} rows={3}
                  className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none" />
                <p className="text-[11px] text-gray-400 mt-1">{autoReply.length}/300</p>
              </Card>
            </>
          )}

          {/* LISTING DEFAULTS */}
          {active === "defaults" && (
            <Card title="Default Listing Settings" subtitle="Pre-filled every time you create a new listing"
              footer={<SaveButton loading={loading.defaults} onClick={saveDefaults} />}>
              <Input label="Default Pickup Location" value={defaultLocation} onChange={setDefaultLocation} placeholder="e.g. GTBank Bus Stop, UNILAG" hint="Pre-fills the location field on new listings" />
              <div className="mb-4">
                <FieldLabel>Default Listing Duration</FieldLabel>
                <div className="flex gap-3">
                  {(["7", "14", "30"] as const).map(d => (
                    <div key={d} onClick={() => setDefaultDuration(d)}
                      className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer font-bold text-sm transition-all ${defaultDuration === d ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600" : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"}`}>
                      {d} days
                    </div>
                  ))}
                </div>
              </div>
              {[
                { key: "autoRenew" as const, val: autoRenew, set: setAutoRenew, label: "Auto-renew listings", sub: "Renew before expiry automatically" },
                { key: "defaultNeg" as const, val: defaultNegotiable, set: setDefaultNegotiable, label: "Mark prices as negotiable by default", sub: "Buyers will see the 'Make Offer' option" },
              ].map(({ key, val, set, label, sub }, i, arr) => (
                <div key={key} className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                  <Toggle value={val} onChange={set} />
                </div>
              ))}
            </Card>
          )}

          {/* SECURITY */}
          {active === "security" && (
            <>
              <Card title="Change Password" footer={<SaveButton loading={loading.password} onClick={changePassword} />}>
                <Input label="Current Password" value={currentPw} onChange={setCurrentPw} type="password" />
                <Input label="New Password" value={newPw} onChange={setNewPw} type="password" placeholder="Min. 8 characters" />
                <Input label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} type="password" />
                {confirmPw && newPw !== confirmPw && <p className="text-xs text-red-500 -mt-3 mb-3">Passwords don&apos;t match</p>}
              </Card>

              <Card title="Active Sessions" subtitle="Devices currently logged into your account">
                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No session data available</p>
                ) : sessions.map((s, i) => (
                  <div key={s.id} className={`flex items-center gap-3 py-3.5 ${i < sessions.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 flex-shrink-0">💻</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.device}</span>
                        {s.current && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>}
                      </div>
                      <p className="text-xs text-gray-400">{s.location} · {s.last_active}</p>
                    </div>
                    {!s.current && (
                      <button onClick={() => revokeSession(s.id)} disabled={loading[`session_${s.id}`]}
                        className="text-xs text-red-500 font-bold border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition-all">
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
            <Card title="Seller Notification Preferences"
              footer={<SaveButton loading={loading.notifs} onClick={saveNotifications} />}>
              <div className="grid grid-cols-[1fr_72px_72px] gap-3 pb-2 mb-1 border-b border-gray-100 dark:border-gray-800">
                <span />
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Email</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Push</span>
              </div>
              <NotifRow label="New buyer inquiry" sub="Buyer messages about your listing"
                emailVal={notifs.inquiry_email} pushVal={notifs.inquiry_push}
                onEmail={v => setNotifs(p => ({ ...p, inquiry_email: v }))} onPush={v => setNotifs(p => ({ ...p, inquiry_push: v }))} />
              <NotifRow label="New review received"
                emailVal={notifs.review_email} pushVal={notifs.review_push}
                onEmail={v => setNotifs(p => ({ ...p, review_email: v }))} onPush={v => setNotifs(p => ({ ...p, review_push: v }))} />
              <NotifRow label="New follower"
                emailVal={notifs.follower_email} pushVal={notifs.follower_push}
                onEmail={v => setNotifs(p => ({ ...p, follower_email: v }))} onPush={v => setNotifs(p => ({ ...p, follower_push: v }))} />
              <NotifRow label="Listing expiring soon" sub="3 days before expiry"
                emailVal={notifs.expiry_email} pushVal={notifs.expiry_push}
                onEmail={v => setNotifs(p => ({ ...p, expiry_email: v }))} onPush={v => setNotifs(p => ({ ...p, expiry_push: v }))} />
              <NotifRow label="Verification decision"
                emailVal={notifs.verif_email} pushVal={notifs.verif_push}
                onEmail={v => setNotifs(p => ({ ...p, verif_email: v }))} onPush={v => setNotifs(p => ({ ...p, verif_push: v }))} />
              <NotifRow label="Competitor priced lower" sub="Similar item listed cheaper"
                emailVal={notifs.competitor_email} pushVal={notifs.competitor_push}
                onEmail={v => setNotifs(p => ({ ...p, competitor_email: v }))} onPush={v => setNotifs(p => ({ ...p, competitor_push: v }))} />
              <NotifRow label="Karma milestone reached"
                emailVal={notifs.karma_email} pushVal={notifs.karma_push}
                onEmail={v => setNotifs(p => ({ ...p, karma_email: v }))} onPush={v => setNotifs(p => ({ ...p, karma_push: v }))} />
              <NotifRow label="Weekly seller digest" sub="Your weekly performance summary"
                emailVal={notifs.weekly_email} pushVal={notifs.weekly_push}
                onEmail={v => setNotifs(p => ({ ...p, weekly_email: v }))} onPush={v => setNotifs(p => ({ ...p, weekly_push: v }))} last />
            </Card>
          )}

          {/* DANGER ZONE */}
          {active === "danger" && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">⏸️ Pause All Listings</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Temporarily hide all active listings. Reactivate anytime from your listings page.</p>
                <button onClick={async () => {
                  setLoad("pauseAll", true);
                  try { await sellerApi.setVacation(token!, { enabled: true, resume_date: null }); showToast("All listings paused", "success"); }
                  catch (e: unknown) { showToast((e instanceof Error ? e.message : null) || "Failed", "error"); }
                  finally { setLoad("pauseAll", false); }
                }} disabled={loading.pauseAll}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-bold hover:bg-blue-100 disabled:opacity-50 transition-all">
                  {loading.pauseAll && <span className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />}
                  Pause All Listings
                </button>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900 rounded-2xl p-6">
                <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-1">⬇️ Downgrade to Buyer Account</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Removes your Verified Seller badge and deactivates all listings. Your buyer account and order history are preserved.
                  Re-verification required to sell again.
                </p>
                <button onClick={downgradeTobuyer} disabled={loading.downgrade}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-xl text-sm font-bold hover:bg-amber-100 disabled:opacity-50 transition-all">
                  {loading.downgrade && <span className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />}
                  Downgrade to Buyer
                </button>
              </div>

              <div className="bg-white dark:bg-gray-900 border-2 border-red-200 dark:border-red-900 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-500">⚠️</span>
                  <h3 className="font-bold text-red-600 dark:text-red-400">Delete Account Permanently</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Permanently deletes your seller account, all listings, reviews, and data. <strong>Cannot be undone.</strong>
                </p>
                {!showDeleteConfirm ? (
                  <button onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-50 dark:bg-red-950 text-red-600 border border-red-200 dark:border-red-800 rounded-xl text-sm font-bold hover:bg-red-100 transition-all">
                    I want to delete my account
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-600 font-semibold mb-3">Type <strong>DELETE</strong> to confirm</p>
                    <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type DELETE here..."
                      className="w-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-700 rounded-xl px-3.5 py-2.5 text-sm mb-3 focus:outline-none transition-colors" />
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
