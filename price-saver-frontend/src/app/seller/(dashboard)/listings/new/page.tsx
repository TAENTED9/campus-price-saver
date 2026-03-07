"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, itemsApi, uploadApi, type Category } from "@/lib/api";
import { X, Upload, ChevronLeft } from "lucide-react";

const CONDITIONS = ["New", "Fairly Used", "Used"] as const;
const DURATIONS = [7, 14, 30] as const;

const inp =
  "h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30";
const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";
const pill = (active: boolean) =>
  `px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
    active
      ? "bg-brand-500 text-white border-brand-500"
      : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-400"
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
  const { token } = useAuth();

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (photos.length >= 5) { setError("Maximum 5 photos allowed"); return; }
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
        <button
          type="button"
          onClick={() => router.push("/seller/verification?ref=listing")}
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
        >
          Complete Verification →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.push("/seller/listings")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
      </div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Add New Listing</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-500/10 dark:text-green-400">{success}</div>
      )}

      {/* Section 1 — Product Info */}
      <SectionCard title="Product Info">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Product Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
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
            <label className={lbl}>Description <span className="text-gray-400 font-normal">(min 20 chars)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              placeholder="Describe your product — condition, size, what's included, any defects, etc."
              className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30" />
          </div>
        </div>
      </SectionCard>

      {/* Section 2 — Pricing */}
      <SectionCard title="Pricing & Condition">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Price (₦) <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" value={price}
              onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
              placeholder="0.00" className={inp} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setIsNegotiable(!isNegotiable)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isNegotiable ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isNegotiable ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Price is negotiable</span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Condition</label>
            <div className="flex gap-2">
              {CONDITIONS.map((c) => (
                <button key={c} type="button" onClick={() => setCondition(c)} className={pill(condition === c)}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Brand</label>
            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Nike, Samsung" className={inp} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={lbl}>Pack Size</label>
              <input type="text" value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="500" className={inp} />
            </div>
            <div className="w-24">
              <label className={lbl}>Unit</label>
              <select value={packUnit} onChange={(e) => setPackUnit(e.target.value)} title="Pack unit" className={inp}>
                <option value="">—</option>
                {["g","kg","ml","L","pcs","pack"].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Section 3 — Photos */}
      <SectionCard title={`Photos (${photos.length}/5)`}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" title="Remove photo" onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors">
                <X size={12} />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-colors disabled:opacity-50">
              {uploadingPhoto ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <Upload size={20} />
              )}
              <span className="text-xs">{uploadingPhoto ? "Uploading..." : "Add Photo"}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          title="Upload listing photo" aria-label="Upload listing photo"
          onChange={handlePhotoUpload} />
        <p className="mt-2 text-xs text-gray-400">JPEG, PNG or WebP · Max 5 MB each · Up to 5 photos</p>
      </SectionCard>

      {/* Section 4 — Availability */}
      <SectionCard title="Availability">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quantity" className={lbl}>Quantity Available</label>
            <input id="quantity" type="number" min="1" max="9999" value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Delivery Options</label>
            <div className="flex gap-4 mt-0.5">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={hasPickup} onChange={(e) => setHasPickup(e.target.checked)}
                  title="Pickup available" className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                Pickup
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={hasDelivery} onChange={(e) => setHasDelivery(e.target.checked)}
                  title="Delivery available" className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                Delivery
              </label>
            </div>
          </div>
          {hasPickup && (
            <div className="sm:col-span-2">
              <label className={lbl}>Pickup Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Moremi Hall, Faculty of Science gate" className={inp} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Section 5 — Duration */}
      <SectionCard title="Listing Duration">
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => setDuration(d)} className={pill(duration === d)}>
              {d} days
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Your listing will expire and auto-deactivate after this period.</p>
      </SectionCard>

      {/* Actions */}
      <div className="flex items-center gap-3 pb-6">
        <button type="button" disabled={submitting}
          onClick={() => handleSubmit("draft")}
          className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5 disabled:opacity-50 transition-colors">
          Save as Draft
        </button>
        <button type="button" disabled={submitting}
          onClick={() => handleSubmit("active")}
          className="flex-1 sm:flex-none px-8 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
          {submitting ? "Submitting..." : "Publish Listing"}
        </button>
      </div>
    </div>
  );
}
