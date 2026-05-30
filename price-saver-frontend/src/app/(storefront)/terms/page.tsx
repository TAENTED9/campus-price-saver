import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, Mail } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Terms of Use | Campify",
  description:
    "Terms governing the use of Campify, the UNILAG student marketplace. Eligibility, seller rules, prohibited items, and more.",
  alternates: { canonical: "https://campify.digital/terms" },
};

const LAST_UPDATED = "May 2026";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/20 mb-4">
          <ScrollText size={28} className="text-white" strokeWidth={2} />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          Terms of Use
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
      </div>

      <article className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using Campify at campify.digital, you agree to be
            bound by these Terms of Use. If you do not agree, do not use the
            platform.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            Campify is exclusively for currently enrolled students of the
            University of Lagos (UNILAG). By registering, you confirm that you
            are a current UNILAG student. Campify reserves the right to verify
            this at any time and suspend accounts that do not meet this
            requirement.
          </p>
        </Section>

        <Section title="3. Accounts">
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must provide accurate information during registration</li>
            <li>You may not share your account with others</li>
            <li>You must notify us immediately of any unauthorized account access</li>
            <li>You may only have one account per person</li>
          </ul>
        </Section>

        <Section title="4. Seller Rules">
          <p>To sell on Campify, you must:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Complete our student verification process and receive approval</li>
            <li>Provide accurate, honest listing descriptions and photos</li>
            <li>Only list items you own and have the right to sell</li>
            <li>Set fair, transparent prices</li>
            <li>Respond to buyer inquiries within a reasonable time</li>
            <li>Honor agreed transactions</li>
          </ul>
        </Section>

        <Section title="5. Prohibited Items">
          <p>The following are strictly prohibited on Campify:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Illegal items of any kind</li>
            <li>Counterfeit or stolen goods</li>
            <li>Prescription drugs or controlled substances</li>
            <li>Adult or sexual content</li>
            <li>Weapons or dangerous items</li>
            <li>Exam papers, answers, or academic dishonesty materials</li>
            <li>Items that violate UNILAG campus regulations</li>
            <li>Services that facilitate any illegal activity</li>
          </ul>
          <p className="mt-3">
            Listings violating this policy will be removed immediately and the
            seller&apos;s account suspended or permanently banned.
          </p>
        </Section>

        <Section title="6. Buyer Responsibilities">
          <p>Buyers are responsible for:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Inspecting items before completing a transaction</li>
            <li>Meeting in safe, public campus locations</li>
            <li>Not making advance payments before receiving items</li>
            <li>Reporting problems promptly via the platform</li>
          </ul>
        </Section>

        <Section title="7. Transactions">
          <p>
            Campify facilitates connections between buyers and sellers but is
            not a party to any transaction. Campify does not handle payments,
            guarantee transactions, or take responsibility for disputes between
            buyers and sellers. Transactions are conducted entirely at the
            parties&apos; own risk.
          </p>
        </Section>

        <Section title="8. Reviews">
          <p>
            Reviews must be honest and based on actual transactions. Fake,
            manipulated, or retaliatory reviews are prohibited and will be
            removed. Reviews may be edited within 10 minutes of posting.
          </p>
        </Section>

        <Section title="9. Karma Points">
          <p>
            Karma Points are non-transferable, have no monetary value, cannot
            be redeemed for cash, and expire if an account is deleted. Campify
            reserves the right to modify the Karma Points system at any time.
          </p>
        </Section>

        <Section title="10. Intellectual Property">
          <p>
            By uploading content to Campify (photos, descriptions, etc.), you
            grant Campify a non-exclusive licence to display that content on
            the platform. You retain ownership of your content.
          </p>
        </Section>

        <Section title="11. Prohibited Conduct">
          <p>Users must not:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Harass, threaten, or abuse other users</li>
            <li>Post spam or misleading content</li>
            <li>Attempt to manipulate search results or listings</li>
            <li>Circumvent our verification or security systems</li>
            <li>Scrape, copy, or redistribute Campify data</li>
            <li>
              Use the platform for any commercial purpose unrelated to campus
              student trade
            </li>
          </ul>
        </Section>

        <Section title="12. Enforcement">
          <p>Campify may, at its discretion:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Remove any listing that violates these Terms</li>
            <li>Suspend accounts temporarily for minor violations</li>
            <li>Permanently ban accounts for serious or repeat violations</li>
            <li>Ban email addresses from re-registering</li>
          </ul>
        </Section>

        <Section title="13. Disclaimers">
          <p>
            Campify is provided &quot;as is&quot; without warranties of any kind. We do
            not guarantee the accuracy of listings, the conduct of users, or
            the outcome of any transaction.
          </p>
        </Section>

        <Section title="14. Limitation of Liability">
          <p>
            To the maximum extent permitted by Nigerian law, Campify shall not
            be liable for any indirect, incidental, or consequential damages
            arising from your use of the platform.
          </p>
        </Section>

        <Section title="15. Governing Law">
          <p>
            These Terms are governed by the laws of the Federal Republic of
            Nigeria. Any disputes shall be subject to the jurisdiction of
            Nigerian courts.
          </p>
        </Section>

        <Section title="16. Contact">
          <p>For questions about these Terms:</p>
          <p className="flex items-center gap-2 mt-2">
            <Mail size={16} className="text-blue-600 dark:text-blue-400" />
            <a
              href={SUPPORT_MAILTO}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {SUPPORT_EMAIL || "Contact support"}
            </a>
          </p>
        </Section>
      </article>

      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          See also our{" "}
          <Link
            href="/privacy"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-[15px]">{children}</div>
    </section>
  );
}
