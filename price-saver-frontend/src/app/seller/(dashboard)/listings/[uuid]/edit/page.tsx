"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, itemsApi, uploadApi, flashSalesApi, type Category, type SellerListing } from "@/lib/api";
import { ChevronLeft, UploadCloud, X, Star, Zap, Check } from "lucide-react";
import NumberInput from "@/components/ui/NumberInput";
import QuantityInput from "@/components/ui/QuantityInput";
import ListingVideoUploader from "@/components/seller/ListingVideoUploader";
import { LocationPicker } from "@/components/locations/LocationPicker";

const CONDITIONS = ["New", "Fairly Used", "Used"] as const;
const DURATIONS = [7, 14, 30] as const;

const inp =
  "h-11 w-full rounded-lg border border-gray-200 bg-white py-2.5 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:[color-scheme:dark] dark:text-white/90 dark:placeholder:text-white/30";
const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
const pill = (active: boolean) =>
  `px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
    active
      ? "bg-brand-500 text-white border-brand-500"
      : "border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-brand-300"
  }`;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5">
      <h3 className="text-sm font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  );
}

const STEPS = ["Product Info", "Pricing", "Photos", "Pickup & Delivery"];

export default function EditListingPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const uuidParam = params?.uuid as string;

  const [listing, setListing]     = useState<SellerListing | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [step, setStep]           = useState(1);

  const [name, setName]               = useState("");
  const [categoryId, setCategoryId]   = useState<number | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition]     = useState<string>("New");
  const [price, setPrice]             = useState<number | "">("");
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [quantity, setQuantity]       = useState(1);
  const [flashSale, setFlashSale]     = useState(false);
  const [flashPrice, setFlashPrice]   = useState<number | "">("");
  const [flashEnd, setFlashEnd]       = useState("");
  const [photos, setPhotos]           = useState<string[]>([]);
  const [videos, setVideos]           = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [hasPickup, setHasPickup]     = useState(true);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [location, setLocation]       = useState("");
  const [duration, setDuration]       = useState<number>(30);
  const [brand, setBrand]             = useState("");
  const [packSize, setPackSize]       = useState("");
  const [packUnit, setPackUnit]       = useState("");
  const [meetupSpots, setMeetupSpots] = useState<string[]>([]);

  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { itemsApi.getCategories().then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    if (!token || !uuidParam) return;
    sellerApi.getListings(token)
      .then((res) => {
        if (!res.success) { setLoadError("Failed to load listing."); return; }
        const found = res.data.find(
          (l) => (l.uuid && l.uuid === uuidParam) || String(l.id) === uuidParam
        );
        if (!found) { setLoadError("Listing not found."); return; }
        setListing(found);
        setName(found.name ?? "");
        setCategoryId(found.category_id ?? "");
        setSubcategory(found.subcategory ?? "");
        setDescription(found.description ?? "");
        setCondition(found.condition ?? "New");
        setPrice(found.price ?? "");
        setIsNegotiable(found.is_negotiable ?? false);
        setQuantity(found.quantity ?? 1);
        setPhotos(found.photos ?? []);
        setVideos(found.videos ?? []);
        setLocation(found.location ?? "");
        setBrand(found.brand ?? "");
        setPackSize(found.pack_size ?? "");
        setPackUnit(found.pack_unit ?? "");
        setMeetupSpots(found.locations ?? []);
        setHasPickup(found.delivery_options?.includes("pickup") ?? true);
        setHasDelivery(found.delivery_options?.includes("delivery") ?? false);
        setDuration(found.duration_days ?? 30);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoadingData(false));
  }, [token, uuidParam]);

  async function uploadFile(file: File) {
    if (!token) return;
    if (photos.length >= 4) { setError("Maximum 4 photos allowed per listing."); return; }
    setUploadingPhoto(true); setError("");
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }


  function canProceed() {
    if (step === 1) return name.trim().length >= 3 && categoryId !== "";
    if (step === 2) return price !== "" && Number(price) > 0;
    return true;
  }

  async function handleSubmit() {
    if (!token || !listing) return;

    // If listing was/will-be active, location + ≥1 canonical pick are required.
    const targetActive = listing.listing_status !== "draft";
    if (targetActive) {
      if (!location.trim()) {
        setError("Enter your primary meetup spot before saving.");
        return;
      }
      if (meetupSpots.length === 0) {
        setError("Pick at least one delivery / meetup location before saving.");
        return;
      }
    }

    if (
      flashSale &&
      (flashPrice === "" || Number(flashPrice) <= 0 || Number(flashPrice) >= Number(price) || !flashEnd)
    ) {
      setError("Flash sale needs a sale price below the listing price and an end date in the future.");
      return;
    }
    setSubmitting(true); setError(""); setSuccess("");
    const deliveryOpts: string[] = [];
    if (hasPickup) deliveryOpts.push("pickup");
    if (hasDelivery) deliveryOpts.push("delivery");
    try {
      await sellerApi.updateListing(token, listing.id, {
        name, category_id: Number(categoryId), subcategory, description,
        condition, price: Number(price), is_negotiable: isNegotiable,
        quantity, photos, videos, location,
        brand: brand.trim() || undefined,
        pack_size: packSize.trim() || undefined,
        pack_unit: packUnit || undefined,
        locations: meetupSpots,
        delivery_options: deliveryOpts.join(","),
        duration_days: duration,
      });

      if (flashSale && user?.id) {
        const discountPct = Math.max(
          0.01,
          Math.min(100, ((Number(price) - Number(flashPrice)) / Number(price)) * 100),
        );
        try {
          await flashSalesApi.create(token, {
            listing_id: listing.id,
            title: name.trim(),
            discount_pct: Number(discountPct.toFixed(2)),
            end_time: new Date(flashEnd).toISOString(),
          });
        } catch (flashErr) {
          setError(
            flashErr instanceof Error
              ? `Listing saved, but flash sale failed: ${flashErr.message}`
              : "Listing saved, but flash sale failed.",
          );
          setSubmitting(false);
          return;
        }
      }

      setSuccess("Listing updated successfully!");
      setTimeout(() => router.push("/seller/listings"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-error-500 font-semibold mb-4">{loadError}</p>
        <button type="button" onClick={() => router.push("/seller/listings")}
          className="text-sm text-brand-500 hover:underline">← Back to listings</button>
      </div>
    );
  }

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
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Edit Listing</h1>
          <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{listing?.name}</p>
        </div>
        <span className="text-sm text-gray-400">Step {step} of 4</span>
      </div>

      {/* Step progress */}
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
                <span className={`text-[10px] font-medium whitespace-nowrap ${current ? "text-brand-500" : "text-gray-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 rounded-full transition-all ${done ? "bg-brand-500" : "bg-gray-100 dark:bg-gray-800"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-500/10 dark:text-green-400">{success}</div>}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <SectionCard title="Product Info">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="flex justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5", "")}>Name <span className="text-red-500">*</span></label>
                <span className={`text-xs font-medium ${name.length < 3 ? "text-error-500" : name.length > 70 ? "text-warning-500" : "text-gray-400"}`}>{name.length}/80</span>
              </div>
              <input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inp} />
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
              <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Brand</label>
              <input type="text" value={brand} maxLength={100}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Peak, Samsung, Indomie" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Pack size</label>
                <input type="text" value={packSize} maxLength={50}
                  onChange={(e) => setPackSize(e.target.value)}
                  placeholder="e.g. 500, 1.5, 12" className={inp} />
              </div>
              <div>
                <label className={lbl}>Unit</label>
                <select value={packUnit} onChange={(e) => setPackUnit(e.target.value)}
                  title="Pack unit" className={inp}>
                  <option value="">—</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="pcs">pcs</option>
                  <option value="pack">pack</option>
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5", "")}>Description</label>
                <span className={`text-xs ${description.length > 900 ? "text-warning-500" : "text-gray-400"}`}>{description.length}/1000</span>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={4}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Condition</label>
              <div className="grid grid-cols-3 gap-3">
                {CONDITIONS.map((c) => (
                  <button key={c} type="button" onClick={() => setCondition(c)}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      condition === c
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600"
                        : "border-gray-200 dark:border-gray-800 text-gray-500"
                    }`}>{c}</button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── STEP 2 ── */}
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
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 sm:col-span-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Price is negotiable</span>
              <button type="button" role="switch" aria-label="Price is negotiable" aria-checked={isNegotiable ? "true" : "false"}
                onClick={() => setIsNegotiable(!isNegotiable)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${isNegotiable ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${isNegotiable ? "translate-x-[18px]" : ""}`} />
              </button>
            </div>
            <div>
              <label htmlFor="qty" className={lbl}>Quantity</label>
              <QuantityInput
                id="qty"
                value={quantity}
                onValueChange={setQuantity}
                min={1}
                max={9999}
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
                    <label htmlFor="edit-flash-price" className="text-xs font-medium text-warning-700 block mb-1">Sale Price (₦)</label>
                    <NumberInput id="edit-flash-price" placeholder="0" value={flashPrice} onValueChange={setFlashPrice} className={inp} />
                  </div>
                  <div>
                    <label htmlFor="edit-flash-end" className="text-xs font-medium text-warning-700 block mb-1">End Date</label>
                    <input id="edit-flash-end" type="datetime-local" title="Flash sale end date" value={flashEnd} onChange={(e) => setFlashEnd(e.target.value)} className={inp} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <SectionCard title={`Photos & Videos (${photos.length}/4 photos)`}>
          {photos.length < 4 && (
            <div onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 dark:border-gray-800 hover:border-brand-300"
              }`}>
              <UploadCloud size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Drop photos here or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · up to 4 photos</p>
              {uploadingPhoto && <p className="text-xs text-brand-500 mt-2 animate-pulse">Uploading…</p>}
            </div>
          )}
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
                  <button type="button" title="Remove photo"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            title="Upload photo" aria-label="Upload listing photo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
          <p className="text-xs text-gray-400">First photo is the listing cover.</p>

          <ListingVideoUploader
            token={token}
            videos={videos}
            onChange={setVideos}
            onError={setError}
          />
        </SectionCard>
      )}

      {/* ── STEP 4 ── */}
      {step === 4 && (
        <SectionCard title="Pickup & Delivery">
          <div className="space-y-5">
            {listing?.needs_location_update && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                This listing was auto-blocked because its old location is no
                longer on our list. Set your primary spot and pick at least
                one canonical spot below to put it back live.
              </div>
            )}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5","")}>
                  Your primary spot <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs font-medium ${
                  location.length > 90 ? "text-warning-500" : "text-gray-400"
                }`}>{location.length}/100</span>
              </div>
              <input
                type="text"
                value={location}
                maxLength={100}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Shop B7 Mariere Hall, my hostel room 224"
                className={inp}
              />
              <p className="mt-1 text-xs text-gray-400">
                Required before publishing. Shown to buyers as your main meetup point.
              </p>
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
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5","")}>
                  Other meetup spots you can deliver to <span className="text-red-500">*</span>
                </label>
              </div>
              <p className="mb-2 text-xs text-gray-400">
                Tick every UNILAG spot you&apos;ll meet buyers at. At least one is required.
              </p>
              <LocationPicker
                value={meetupSpots}
                onChange={setMeetupSpots}
                required
              />
            </div>
            <div>
              <label className={lbl}>Listing Duration</label>
              <div className="flex gap-2">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" onClick={() => setDuration(d)} className={pill(duration === d)}>{d} days</button>
                ))}
              </div>
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
          <button type="button" disabled={submitting} onClick={handleSubmit}
            className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity">
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
