import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ListingShape = {
  uuid?: string;
  name?: string;
  title?: string;
  price?: number | string;
  description?: string;
  photos?: string[];
} | null;

async function fetchListing(idOrSlug: string): Promise<ListingShape> {
  const isNumeric = /^\d+$/.test(idOrSlug);
  const url = isNumeric
    ? `${API}/api/storefront/listing/${idOrSlug}`
    : `${API}/api/listings/${idOrSlug}`;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as ListingShape;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListing(id);

  if (!listing) {
    return {
      title: "Listing | Campify",
      description: "Browse student-listed items on Campify.",
    };
  }

  const title = listing.name || listing.title || "Listing";
  const price =
    listing.price != null
      ? `₦${Number(listing.price).toLocaleString()}`
      : "";
  const desc =
    (listing.description ?? "").slice(0, 155) ||
    `${title} for sale on Campify, the UNILAG student marketplace.`;
  const photo = listing.photos?.[0];

  return {
    title: price ? `${title} — ${price} | Campify` : `${title} | Campify`,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "website",
      siteName: "Campify",
      images: photo
        ? [{ url: photo, width: 800, height: 600, alt: title }]
        : [],
    },
    twitter: {
      card: photo ? "summary_large_image" : "summary",
      title,
      description: desc,
      images: photo ? [photo] : [],
    },
    alternates: listing.uuid
      ? { canonical: `https://campify.ng/listing/${listing.uuid}` }
      : undefined,
  };
}

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
