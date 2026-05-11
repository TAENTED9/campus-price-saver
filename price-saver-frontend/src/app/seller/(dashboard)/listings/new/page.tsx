"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, itemsApi, uploadApi, flashSalesApi, type Category } from "@/lib/api";
import { X, Upload, ChevronLeft, UploadCloud, Star, Zap, Check } from "lucide-react";
import NumberInput from "@/components/ui/NumberInput";

const CONDITIONS = ["New", "Fairly Used", "Used"] as const;
const DURATIONS = [7, 14, 30] as const;

const inp =
  "h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:[color-scheme:dark] dark:text-white/90 dark:placeholder:text-white/30";
const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
const pill = (active: boolean) =>
  `px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
    active
      ? "bg-brand-500 text-white border-brand-500"
      : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-800 dark:text-gray-400"
  }`;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <h2 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function NewListingPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [verifGate, setVerifGate] = useState<"checking" | "ok" | "required">("checking");
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [condition, setCondition] = useState<string>("New");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [hasPickup, setHasPickup] = useState(true);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [brand, setBrand] = useState("");
  const [packSize, setPackSize] = useState("");
  const [packUnit, setPackUnit] = useState("");

  const [step, setStep]           = useState(1);
  const [makeOffer, setMakeOffer]   = useState(false);
  const [flashSale, setFlashSale]   = useState(false);
  const [flashPrice, setFlashPrice] = useState<number | "">("");
  const [flashEnd, setFlashEnd]     = useState("");
  const [autoRenew, setAutoRenew]   = useState(false);
  const [meetupSpots, setMeetupSpots] = useState<string[]>([]);
  const [dragOver, setDragOver]     = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const MEETUP_SPOTS = ["GTBank bus stop", "Moremi Hall gate", "Faculty of Science gate", "University Senate building", "Amina Hall", "Kuti Hall", "Angola", "Nithub", "New Hall", "Freedom Park"];

  useEffect(() => {
    itemsApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Verification gate — redirect to verification form if not yet submitted
  useEffect(() => {
    if (!token) return;
    sellerApi.getVerification(token)
      .then((res) => setVerifGate(res.data === null ? "required" : "ok"))
      .catch(() => setVerifGate("ok")); // fail open
  }, [token]);

  async function uploadFile(file: File) {
    if (!token) return;
    if (photos.length >= 8) { setError("Maximum 8 photos allowed"); return; }
    setUploadingPhoto(true);
    setError("");
    try {
      const url = await uploadApi.uploadListingPhoto(token, file);
      setPhotos((prev) => [...prev, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }

  function toggleMeetupSpot(spot: string) {
    setMeetupSpots((prev) =>
      prev.includes(spot) ? prev.filter((s) => s !== spot) : [...prev, spot]
    );
  }

  function canProceed() {
    if (step === 1) return name.trim().length >= 3 && categoryId !== "";
    if (step === 2) return price !== "" && Number(price) > 0;
    return true;
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function buildDeliveryOptions() {
    const opts: string[] = [];
    if (hasPickup) opts.push("pickup");
    if (hasDelivery) opts.push("delivery");
    return opts.join(",");
  }

  async function handleSubmit(listingStatus: "draft" | "active") {
    setError("");
    setSuccess("");
    if (!token) { setError("You must be logged in."); return; }
    if (!name.trim() || categoryId === "" || price === "" || Number(price) <= 0) {
      setError("Product name, category and price are required.");
      return;
    }

    if (
      listingStatus === "active" &&
      flashSale &&
      (flashPrice === "" || Number(flashPrice) <= 0 || Number(flashPrice) >= Number(price) || !flashEnd)
    ) {
      setError("Flash sale needs a sale price below the listing price and an end date in the future.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await sellerApi.createListing(token, {
        name: name.trim(),
        category_id: Number(categoryId),
        price: Number(price),
        brand: brand.trim() || undefined,
        pack_size: packSize.trim() || undefined,
        pack_unit: packUnit || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        subcategory: subcategory.trim() || undefined,
        condition,
        quantity,
        is_negotiable: isNegotiable,
        delivery_options: buildDeliveryOptions() || undefined,
        duration_days: duration,
        listing_status: listingStatus,
        photos,
      });

      if (listingStatus === "active" && flashSale && user?.id && res.id) {
        const discountPct = Math.max(
          0.01,
          Math.min(100, ((Number(price) - Number(flashPrice)) / Number(price)) * 100),
        );
        const endIso = new Date(flashEnd).toISOString();
        try {
          await flashSalesApi.create(
            {
              price_id: res.id,
              title: name.trim(),
              discount_pct: Number(discountPct.toFixed(2)),
              end_time: endIso,
            },
            user.id,
          );
        } catch (flashErr) {
          setError(
            flashErr instanceof Error
              ? `Listing created, but flash sale failed: ${flashErr.message}`
              : "Listing created, but flash sale failed.",
          );
          setSubmitting(false);
          return;
        }
      }

      setSuccess(res.message);
      setTimeout(() => router.push("/seller/listings"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (verifGate === "checking") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (verifGate === "required") {
    return (
      <div className="mx-auto max-w-md py-10 text-center space-y-5">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-brand-50 dark:bg-brand-500/10">
          <Upload size={28} className="text-brand-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">Verification required to list</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You need to complete your seller verification before you can list products. It only takes a minute.
        </p>
        <button type="button" onClick={() => router.push("/seller/verification?ref=listing")}
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors">
          Complete Verification →
        </button>
      </div>
    );
  }

  const STEPS = ["Product Info", "Pricing", "Photos", "Pickup & Delivery"];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button"
          onClick={() => step > 1 ? setStep(step - 1) : router.push("/seller/listings")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 transition-colors">
          <ChevronLeft size={16} /> {step > 1 ? "Back" : "Listings"}
        </button>
      </div>

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Add New Listing</h1>
        <span className="text-sm text-gray-400">Step {step} of 4</span>
      </div>

      {/* Step progress indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? "bg-brand-500 text-white" :
                  current ? "bg-brand-500 text-white ring-4 ring-brand-100 dark:ring-brand-500/20" :
                  "bg-gray-100 dark:bg-gray-800 text-gray-400"
                }`}>
                  {done ? <Check size={12} /> : n}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${
                  current ? "text-brand-500" : "text-gray-400"
                }`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 rounded-full transition-all ${
                  done ? "bg-brand-500" : "bg-gray-100 dark:bg-gray-800"
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-500/10 dark:text-green-400">{success}</div>
      )}

      {/* ── STEP 1: Product Info ── */}
      {step === 1 && (
        <SectionCard title="Product Info">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5","")}>Product Name <span className="text-red-500">*</span></label>
                <span className={`text-xs font-medium ${
                  name.length < 3 ? "text-error-500" : name.length > 70 ? "text-warning-500" : "text-gray-400"
                }`}>{name.length}/80</span>
              </div>
              <input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Golden Penny Spaghetti 500g" className={inp} />
            </div>
            <div>
              <label className={lbl}>Category <span className="text-red-500">*</span></label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} title="Category" className={inp}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Subcategory</label>
              <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Rice, Frozen Foods, Dresses" className={inp} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5","")}>Description</label>
                <span className={`text-xs font-medium ${description.length > 900 ? "text-warning-500" : "text-gray-400"}`}>{description.length}/1000</span>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={4}
                placeholder="Describe your product — condition, size, what's included, any defects, etc."
                className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Condition</label>
              <div className="grid grid-cols-3 gap-3">
                {CONDITIONS.map((c) => (
                  <button key={c} type="button" onClick={() => setCondition(c)}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      condition === c
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                    }`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── STEP 2: Pricing & Availability ── */}
      {step === 2 && (
        <SectionCard title="Pricing & Availability">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={lbl}>Price <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₦</span>
                <NumberInput value={price} onValueChange={setPrice} placeholder="0" className={`${inp} pl-8`} />
              </div>
            </div>

            {[{
              label: "Price is negotiable",
              checked: isNegotiable, toggle: () => setIsNegotiable(!isNegotiable),
            }, {
              label: "Accept offers / Make Offer",
              checked: makeOffer, toggle: () => setMakeOffer(!makeOffer),
            }].map((t) => (
              <div key={t.label} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                <button type="button" role="switch" aria-label={t.label} onClick={t.toggle}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${t.checked ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  aria-checked={t.checked ? "true" : "false"}>
                  <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${t.checked ? "translate-x-[18px]" : ""}`} />
                </button>
              </div>
            ))}

            <div>
              <label htmlFor="quantity" className={lbl}>Quantity Available</label>
              <NumberInput
                id="quantity"
                value={quantity}
                onValueChange={(v) => setQuantity(Math.max(1, Number(v) || 1))}
                maxDigits={4}
                className={inp}
              />
            </div>

            <div className="sm:col-span-2 space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-warning-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Flash Sale</span>
                </div>
                <button type="button" role="switch" aria-label="Flash Sale" aria-checked={flashSale ? "true" : "false"} onClick={() => setFlashSale(!flashSale)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${flashSale ? "bg-warning-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${flashSale ? "translate-x-[18px]" : ""}`} />
                </button>
              </div>
              {flashSale && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-warning-50 dark:bg-warning-500/10 rounded-xl border border-warning-200 dark:border-warning-500/30">
                  <div>
                    <label className="text-xs font-medium text-warning-700 dark:text-warning-400 block mb-1">Sale Price (₦)</label>
                    <NumberInput title="Flash sale price" placeholder="0" value={flashPrice} onValueChange={setFlashPrice} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-warning-700 dark:text-warning-400 block mb-1">End Date & Time</label>
                    <input type="datetime-local" title="Flash sale end date" value={flashEnd} onChange={(e) => setFlashEnd(e.target.value)} className={inp} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── STEP 3: Photos & Video ── */}
      {step === 3 && (
        <SectionCard title={`Photos (${photos.length}/8)`}>
          {/* Drag & Drop zone */}
          {photos.length < 8 && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-300 dark:border-gray-800 hover:border-brand-300 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              }`}
            >
              <UploadCloud size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Drop photos here or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · up to 8 photos</p>
              {uploadingPhoto && <p className="text-xs text-brand-500 mt-2 animate-pulse">Uploading…</p>}
            </div>
          )}

          {/* Preview grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5 mb-3">
              {photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && (
                    <div className="absolute top-1 left-1 bg-warning-400 text-white rounded px-1 py-0.5 text-[11px] font-bold flex items-center gap-0.5">
                      <Star size={8} className="fill-white" /> Cover
                    </div>
                  )}
                  <button type="button" title="Remove photo" onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            title="Upload listing photo" aria-label="Upload listing photo"
            onChange={handlePhotoUpload} />
          <p className="text-xs text-gray-400">First photo will be used as the listing cover.</p>
        </SectionCard>
      )}

      {/* ── STEP 4: Pickup & Delivery ── */}
      {step === 4 && (
        <SectionCard title="Pickup & Delivery">
          <div className="space-y-5">
            <div>
              <label className={lbl}>Pickup Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Moremi Hall, Faculty of Science gate" className={inp} />
            </div>

            <div>
              <label className={lbl}>Delivery Options</label>
              <div className="flex gap-2">
                {(["Pickup Only", "Campus Delivery", "Both"] as const).map((opt) => {
                  const isActive = opt === "Both" ? hasPickup && hasDelivery :
                    opt === "Pickup Only" ? hasPickup && !hasDelivery : !hasPickup && hasDelivery;
                  return (
                    <button key={opt} type="button" onClick={() => {
                      if (opt === "Pickup Only") { setHasPickup(true); setHasDelivery(false); }
                      else if (opt === "Campus Delivery") { setHasPickup(false); setHasDelivery(true); }
                      else { setHasPickup(true); setHasDelivery(true); }
                    }} className={pill(isActive)}>{opt}</button>
                  );
                })}
              </div>
            </div>

            {hasDelivery && (
              <div>
                <label className={lbl}>Delivery Fee (₦)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <NumberInput value="" onValueChange={() => {}} placeholder="0" className={`${inp} pl-8`} />
                </div>
              </div>
            )}

            <div>
              <label className={lbl}>Meetup Spots</label>
              <div className="grid grid-cols-2 gap-2">
                {MEETUP_SPOTS.map((spot) => (
                  <label key={spot} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={meetupSpots.includes(spot)} onChange={() => toggleMeetupSpot(spot)}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{spot}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={lbl}>Listing Duration</label>
              <div className="flex gap-2">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" onClick={() => setDuration(d)} className={pill(duration === d)}>{d} days</button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-renew listing on expiry</span>
              <button type="button" role="switch" aria-label="Auto-renew listing" aria-checked={autoRenew ? "true" : "false"} onClick={() => setAutoRenew(!autoRenew)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${autoRenew ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${autoRenew ? "translate-x-[18px]" : ""}`} />
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Navigation footer */}
      <div className="flex items-center gap-3 pb-6">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)}
            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            Back
          </button>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()}
            className="px-8 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
            Next →
          </button>
        ) : (
          <>
            <button type="button" disabled={submitting} onClick={() => handleSubmit("draft")}
              className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors">
              Save Draft
            </button>
            <button type="button" disabled={submitting} onClick={() => handleSubmit("active")}
              className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90">
              {submitting ? "Publishing…" : "Publish Listing"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
