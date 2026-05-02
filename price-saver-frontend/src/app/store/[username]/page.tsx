import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { storefrontApi, type SellerStorefront } from "@/lib/api";
import StorePageClient from "@/components/storefront/StorePageClient";

// ── ISR: revalidate every 60 seconds ──────────────────────────────────────
export const revalidate = 60;

// ── Static params: pre-build top 50 seller pages at deploy ────────────────
export async function generateStaticParams() {
  try {
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${BASE}/api/storefront/slugs`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.slugs as string[]).map((username) => ({ username }));
  } catch {
    return [];
  }
}

// ── Page metadata ──────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  try {
    const data: SellerStorefront = await storefrontApi.getSellerPage(username);
    const name = data.seller.display_name || data.seller.username;
    return {
      title: `${name} — Campify`,
      description: data.seller.bio
        ? data.seller.bio.slice(0, 155)
        : `Browse ${name}'s listings on Campify, the UNILAG student marketplace.`,
      openGraph: {
        title: `${name} on Campify`,
        description: data.seller.bio ?? `${data.listing_count} active listings`,
        images: data.seller.avatar_url ? [data.seller.avatar_url] : [],
      },
    };
  } catch {
    return { title: "Seller — Campify" };
  }
}

// ── Page (Server Component) ────────────────────────────────────────────────

export default async function SellerStorefrontPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let data: SellerStorefront;
  try {
    data = await storefrontApi.getSellerPage(username);
  } catch {
    notFound();
  }

  const { seller, listings, listing_count, owner_user_id, owner_uuid } = data!;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Cover photo + profile + tabs are all inside StorePageClient for edit-in-place support */}
      <StorePageClient
        seller={seller}
        listings={listings}
        listingCount={listing_count}
        ownerUserId={owner_user_id ?? null}
        ownerUuid={owner_uuid ?? null}
      />
    </div>
  );
}
