"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Rocket,
  ShieldCheck,
  PackageOpen,
  Store,
  Sparkles,
  Megaphone,
  Gavel,
  Menu,
  X,
} from "lucide-react";

type SectionKey =
  | "getting-started"
  | "verification"
  | "listings"
  | "managing"
  | "karma"
  | "promotions"
  | "policies";

const SECTIONS: { key: SectionKey; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "getting-started", label: "Getting Started", Icon: Rocket },
  { key: "verification", label: "Verification", Icon: ShieldCheck },
  { key: "listings", label: "Creating Listings", Icon: PackageOpen },
  { key: "managing", label: "Managing Your Store", Icon: Store },
  { key: "karma", label: "Karma Points", Icon: Sparkles },
  { key: "promotions", label: "Promotions", Icon: Megaphone },
  { key: "policies", label: "Policies & Rules", Icon: Gavel },
];

export default function SellerDocsPage() {
  const [active, setActive] = useState<SectionKey>("getting-started");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          Seller Documentation
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Everything you need to know to sell successfully on Campify
        </p>
      </div>

      {/* Mobile toggle */}
      <div className="lg:hidden mb-5">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
        >
          <span>
            {SECTIONS.find((s) => s.key === active)?.label || "Sections"}
          </span>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside
          className={
            "lg:col-span-1 lg:block " + (mobileOpen ? "block" : "hidden")
          }
        >
          <nav className="lg:sticky lg:top-24 space-y-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3">
            {SECTIONS.map(({ key, label, Icon }) => {
              const isActive = active === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActive(key);
                    setMobileOpen(false);
                  }}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-left " +
                    (isActive
                      ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800")
                  }
                >
                  <Icon size={16} className={isActive ? "text-white" : "text-blue-600 dark:text-blue-400"} />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8">
          {active === "getting-started" && <GettingStarted />}
          {active === "verification" && <Verification />}
          {active === "listings" && <CreatingListings />}
          {active === "managing" && <Managing />}
          {active === "karma" && <KarmaPoints />}
          {active === "promotions" && <Promotions />}
          {active === "policies" && <Policies />}
        </div>
      </div>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-4">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside ml-5 space-y-1.5 text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
      {children}
    </ul>
  );
}

function GettingStarted() {
  return (
    <article>
      <H2>Getting Started</H2>
      <H3>What is Campify?</H3>
      <P>
        Campify is the trusted marketplace for UNILAG students. It connects
        student sellers with student buyers right on campus, replacing
        scattered WhatsApp groups with a single, verified place to trade.
      </P>
      <H3>Who can sell?</H3>
      <P>
        Only verified UNILAG students can sell on Campify. You must complete
        student verification before publishing any listing.
      </P>
      <H3>Creating your seller account</H3>
      <UL>
        <li>Register a Campify account at /signup</li>
        <li>Complete your profile (display name, bio, profile photo)</li>
        <li>Submit your verification documents</li>
        <li>Once approved, you can start listing products</li>
      </UL>
      <H3>System requirements</H3>
      <P>
        All you need is a smartphone or computer with a browser, a working
        email address, and your UNILAG student ID.
      </P>
    </article>
  );
}

function Verification() {
  return (
    <article>
      <H2>Verification</H2>
      <H3>Why verification is required</H3>
      <P>
        Verification keeps Campify safe. By limiting sellers to confirmed
        UNILAG students, we protect buyers from impersonation, scams, and
        outsiders selling on campus.
      </P>
      <H3>What documents are needed</H3>
      <UL>
        <li>UNILAG Student ID card (JPEG/PNG, max 5MB)</li>
        <li>Student Portal screenshot showing your name and matric number</li>
        <li>Matric number (9 digits, e.g. 190101001 or 190101001/ED)</li>
        <li>Faculty / Department</li>
        <li>Business category (what you plan to sell)</li>
        <li>Campus pickup location</li>
      </UL>
      <H3>Review timeline</H3>
      <P>
        Submissions are reviewed within 24-48 hours. You will receive an
        email notification once your application is approved or rejected.
      </P>
      <H3>What happens after approval</H3>
      <UL>
        <li>You receive a verified seller badge on your profile</li>
        <li>+100 Karma Points credited to your account</li>
        <li>You can publish listings to the marketplace</li>
        <li>Your storefront becomes available at /store/[username]</li>
      </UL>
      <H3>If your application is rejected</H3>
      <P>
        You can resubmit with the correct documents. Common reasons for
        rejection: blurry photos, mismatched names, or expired IDs. Read
        your rejection email carefully for guidance.
      </P>
    </article>
  );
}

function CreatingListings() {
  return (
    <article>
      <H2>Creating Listings</H2>
      <H3>Listing requirements</H3>
      <UL>
        <li>Clear, descriptive title</li>
        <li>Honest description of the item and condition</li>
        <li>Price in whole numbers (formatted in Naira)</li>
        <li>Condition: New, Fairly Used, or Used</li>
        <li>Category and campus pickup location</li>
        <li>Up to 5 photos per listing</li>
      </UL>
      <H3>Photo guidelines</H3>
      <UL>
        <li>Use good lighting (natural light works best)</li>
        <li>Take multiple angles so buyers know exactly what they&apos;re getting</li>
        <li>Show any defects honestly — surprises kill trust</li>
        <li>Avoid heavy filters or misleading edits</li>
      </UL>
      <H3>Pricing tips</H3>
      <UL>
        <li>Search similar items first to see what they sell for</li>
        <li>Price competitively — overpriced listings sit unsold</li>
        <li>Use round, whole numbers for clarity</li>
      </UL>
      <H3>Listing status</H3>
      <P>
        Every new listing is reviewed by our admin team. The flow is:
        <strong> Pending → Approved → Live on homepage</strong>. Approval
        usually takes a few hours.
      </P>
      <H3>Products NOT allowed</H3>
      <UL>
        <li>Anything illegal</li>
        <li>Counterfeit or stolen goods</li>
        <li>Adult content</li>
        <li>Prescription drugs</li>
        <li>Exam papers, answers, or any academic dishonesty material</li>
      </UL>
    </article>
  );
}

function Managing() {
  return (
    <article>
      <H2>Managing Your Store</H2>
      <H3>Editing a listing</H3>
      <P>
        Go to Seller Dashboard → Listings, then click Edit on any listing to
        update photos, price, description, or pickup location.
      </P>
      <H3>Marking as sold</H3>
      <P>
        When you complete a sale, mark the listing as sold so it stops
        appearing as active. This also rewards you with Karma when buyers
        leave reviews.
      </P>
      <H3>Responding to inquiries</H3>
      <P>
        Buyer messages arrive in your Inbox. Responding within 5 minutes
        earns Karma Points and boosts your visibility in search results.
      </P>
      <H3>Your storefront page</H3>
      <P>
        Every verified seller gets a public storefront at{" "}
        <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
          campify.digital/store/[username]
        </span>
        . Share this link to drive followers and direct buyers to all your
        listings in one place.
      </P>
      <H3>Followers</H3>
      <P>
        Buyers can follow your store to get notified of new listings. Keep
        listings active and respond quickly to grow your follower count.
      </P>
    </article>
  );
}

function KarmaPoints() {
  return (
    <article>
      <H2>Karma Points</H2>
      <P>
        Karma Points reward sellers for being active, honest, and responsive.
        Spend them on promotions to boost your listing visibility.
      </P>

      <H3>Earning Karma</H3>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Action</th>
              <th className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">Points</th>
            </tr>
          </thead>
          <tbody className="text-gray-600 dark:text-gray-300">
            <KarmaRow action="Get verified" points="+100 pts" />
            <KarmaRow action="Complete your profile" points="+50 pts" />
            <KarmaRow action="Publish first listing" points="+25 pts" />
            <KarmaRow action="Receive a 5-star review" points="+15 pts" />
            <KarmaRow action="Respond to 5 inquiries within 5 min" points="+5 pts" />
          </tbody>
        </table>
      </div>

      <H3>Tiers</H3>
      <UL>
        <li><strong>0 pts</strong> — New Seller</li>
        <li><strong>50 pts</strong> — Rising Seller</li>
        <li><strong>150 pts</strong> — Active Seller</li>
        <li><strong>300 pts</strong> — Power Seller</li>
        <li><strong>600 pts</strong> — Elite Seller</li>
      </UL>
    </article>
  );
}

function KarmaRow({ action, points }: { action: string; points: string }) {
  return (
    <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="px-4 py-2.5">{action}</td>
      <td className="px-4 py-2.5 font-semibold text-blue-600 dark:text-blue-400">{points}</td>
    </tr>
  );
}

function Promotions() {
  return (
    <article>
      <H2>Promotions</H2>
      <P>
        Use your Karma Points to boost your listings and reach more buyers.
      </P>
      <UL>
        <li><strong>Boost listing (24h)</strong> — 50 pts</li>
        <li><strong>Category feature (48h)</strong> — 120 pts</li>
        <li><strong>Homepage week</strong> — 300 pts</li>
        <li><strong>Flash Sales</strong> — coming soon</li>
      </UL>
      <P>
        To redeem, head to your Seller Dashboard → Promotions and select the
        listing you want to boost.
      </P>
    </article>
  );
}

function Policies() {
  return (
    <article>
      <H2>Policies & Rules</H2>
      <UL>
        <li>No fake listings or misleading descriptions</li>
        <li>No harassment of buyers</li>
        <li>
          Campify reserves the right to remove listings and suspend accounts
          that violate community standards
        </li>
      </UL>
      <P>
        Review our full policies on the{" "}
        <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
          Privacy Policy
        </Link>{" "}
        pages.
      </P>
    </article>
  );
}
