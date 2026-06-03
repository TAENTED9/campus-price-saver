"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, itemsApi, uploadApi, type Category } from "@/lib/api";
import { X, Upload, ChevronLeft, UploadCloud, Star, Zap, Check, Lock } from "lucide-react";
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
  const [videos, setVideos] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [hasPickup, setHasPickup] = useState(true);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [brand, setBrand] = useState("");
  const [packSize, setPackSize] = useState("");
  const [packUnit, setPackUnit] = useState("");

  const [step, setStep]           = useState(1);
  const [flashLockHint, setFlashLockHint] = useState(false); // new listings are pending → flash sale locked until approved
  const [meetupSpots, setMeetupSpots] = useState<string[]>([]);
  const [dragOver, setDragOver]     = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Draft autosave (survives accidental logout / network drop / refresh) ──
  // Scoped per-user so a draft never leaks across accounts on a shared device.
  const draftKey = user?.id ? `campify:listing-draft:${user.id}` : null;
  const [hydrated, setHydrated]         = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    itemsApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  // Restore a previously-saved draft once we know which user we are.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.name === "string") setName(d.name);
        if (typeof d.categoryId === "number" || d.categoryId === "") setCategoryId(d.categoryId);
        if (typeof d.subcategory === "string") setSubcategory(d.subcategory);
        if (typeof d.description === "string") setDescription(d.description);
        if (typeof d.price === "number" || d.price === "") setPrice(d.price);
        if (typeof d.isNegotiable === "boolean") setIsNegotiable(d.isNegotiable);
        if (typeof d.condition === "string") setCondition(d.condition);
        if (Array.isArray(d.photos)) setPhotos(d.photos);
        if (Array.isArray(d.videos)) setVideos(d.videos);
        if (typeof d.quantity === "number") setQuantity(d.quantity);
        if (typeof d.hasPickup === "boolean") setHasPickup(d.hasPickup);
        if (typeof d.hasDelivery === "boolean") setHasDelivery(d.hasDelivery);
        if (typeof d.deliveryFee === "number" || d.deliveryFee === "") setDeliveryFee(d.deliveryFee);
        if (typeof d.location === "string") setLocation(d.location);
        if (typeof d.duration === "number") setDuration(d.duration);
        if (typeof d.brand === "string") setBrand(d.brand);
        if (typeof d.packSize === "string") setPackSize(d.packSize);
        if (typeof d.packUnit === "string") setPackUnit(d.packUnit);
        // flashSale intentionally not restored — it stays locked off until the
        // listing is approved (see toggle below).
        if (Array.isArray(d.meetupSpots)) setMeetupSpots(d.meetupSpots);
        if (typeof d.step === "number") setStep(d.step);
        setDraftRestored(true);
      }
    } catch { /* corrupt draft — ignore */ }
    setHydrated(true); // batched with the setters above → save effect sees restored values
  }, [draftKey]);

  // Debounced autosave whenever a field changes (after the initial restore).
  useEffect(() => {
    if (!draftKey || !hydrated) return;
    const hasContent =
      name.trim() || description.trim() || price !== "" ||
      photos.length > 0 || videos.length > 0 || brand.trim() || location.trim();
    const t = setTimeout(() => {
      try {
        if (!hasContent) { localStorage.removeItem(draftKey); return; }
        localStorage.setItem(draftKey, JSON.stringify({
          name, categoryId, subcategory, description, price, isNegotiable, condition,
          photos, videos, quantity, hasPickup, hasDelivery, deliveryFee, location,
          duration, brand, packSize, packUnit, meetupSpots, step, savedAt: Date.now(),
        }));
      } catch { /* quota / private mode — best-effort only */ }
    }, 600);
    return () => clearTimeout(t);
  }, [draftKey, hydrated, name, categoryId, subcategory, description, price, isNegotiable,
      condition, photos, videos, quantity, hasPickup, hasDelivery, deliveryFee, location,
      duration, brand, packSize, packUnit, meetupSpots, step]);

  function clearDraft() {
    if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
  }

  function discardDraft() {
    clearDraft();
    window.location.reload(); // simplest reliable reset back to a blank form
  }

  // Verification gate — redirect to verification form if not yet submitted
  useEffect(() => {
    if (!token) return;
    sellerApi.getVerification(token)
      .then((res) => setVerifGate(res.data === null ? "required" : "ok"))
      .catch(() => setVerifGate("ok")); // fail open
  }, [token]);


  async function uploadFile(file: File) {
    if (!token) return;
    if (photos.length >= 4) { setError("Maximum 4 photos allowed per listing."); return; }
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

    // Publishing requires both the seller's primary spot and ≥1 canonical pick.
    // Drafts can be saved with either/both empty.
    if (listingStatus === "active") {
      if (!location.trim()) {
        setError("Enter your primary meetup spot before publishing.");
        return;
      }
      if (meetupSpots.length === 0) {
        setError("Pick at least one delivery / meetup location before publishing.");
        return;
      }
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
        locations: meetupSpots,
        description: description.trim() || undefined,
        subcategory: subcategory.trim() || undefined,
        condition,
        quantity,
        is_negotiable: isNegotiable,
        delivery_options: buildDeliveryOptions() || undefined,
        delivery_fee: hasDelivery && deliveryFee !== "" ? Number(deliveryFee) : undefined,
        duration_days: duration,
        listing_status: listingStatus,
        photos,
        videos,
      });

      // Flash sales aren't offered at creation time — a new listing is pending
      // approval, and a flash sale can only run on an approved listing. Sellers
      // enable it later from Edit Listing once approved.
      clearDraft();
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

      {draftRestored && !success && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
          <span>We restored your unsaved listing. Pick up right where you left off.</span>
          <button type="button" onClick={discardDraft}
            className="shrink-0 font-medium underline hover:no-underline">
            Discard &amp; start fresh
          </button>
        </div>
      )}

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

            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-700 dark:text-gray-300">Price is negotiable</span>
              <button type="button" role="switch" aria-label="Price is negotiable"
                onClick={() => setIsNegotiable(!isNegotiable)}
                aria-checked={isNegotiable ? "true" : "false"}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${isNegotiable ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${isNegotiable ? "translate-x-[18px]" : ""}`} />
              </button>
            </div>

            <div>
              <label htmlFor="quantity" className={lbl}>Quantity Available</label>
              <QuantityInput
                id="quantity"
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
                  <Zap size={15} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Flash Sale</span>
                  <Lock size={12} className="text-gray-400" />
                </div>
                {/* Locked: a brand-new listing is pending approval, so a flash
                    sale can't run yet. Tapping explains how to enable it later. */}
                <button type="button" role="switch" aria-label="Flash Sale (locked until approved)"
                  aria-checked="false" onClick={() => setFlashLockHint(true)}
                  className="relative w-10 h-5.5 rounded-full bg-gray-200 dark:bg-gray-700 cursor-not-allowed">
                  <span className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow" />
                </button>
              </div>
              {flashLockHint && (
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                  Flash sales unlock once your listing is approved. You&apos;ll be able to
                  turn it on from <span className="font-medium">Edit Listing</span> then.
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── STEP 3: Photos & Video ── */}
      {step === 3 && (
        <SectionCard title={`Photos & Videos (${photos.length}/4 photos)`}>
          {/* Drag & Drop zone */}
          {photos.length < 4 && (
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
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · up to 4 photos</p>
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
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-500">
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

          <ListingVideoUploader
            token={token}
            videos={videos}
            onChange={setVideos}
            onError={setError}
          />
        </SectionCard>
      )}

      {/* ── STEP 4: Pickup & Delivery ── */}
      {step === 4 && (
        <SectionCard title="Pickup & Delivery">
          <div className="space-y-5">
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
                placeholder="e.g. Shop B7 Mariere Hall, my hostel room 224, kiosk near gate B"
                className={inp}
              />
              <p className="mt-1 text-xs text-gray-400">
                Required before publishing. Buyers see this first as your main meetup point.
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

            {hasDelivery && (
              <div>
                <label className={lbl}>Delivery Fee (₦)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <NumberInput
                    value={deliveryFee}
                    onValueChange={(v) => setDeliveryFee(v === "" ? "" : Number(v))}
                    placeholder="0"
                    className={`${inp} pl-8`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Leave blank for free delivery, or set a flat fee buyers will pay on top of the listing price.
                </p>
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className={lbl.replace(" mb-1.5","")}>
                  Other meetup spots you can deliver to <span className="text-red-500">*</span>
                </label>
              </div>
              <p className="mb-2 text-xs text-gray-400">
                Tick every UNILAG spot you&apos;ll meet buyers at. At least one is required to publish.
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
