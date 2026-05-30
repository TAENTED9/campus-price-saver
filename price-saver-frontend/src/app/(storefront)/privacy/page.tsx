import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Mail, MapPin } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Privacy Policy | Campify",
  description:
    "How Campify collects, uses, stores, and protects your personal information. NDPR-compliant privacy practices for UNILAG students.",
  alternates: { canonical: "https://campify.digital/privacy" },
};

const LAST_UPDATED = "May 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/20 mb-4">
          <ShieldCheck size={28} className="text-white" strokeWidth={2} />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
      </div>

      <article className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
        <Section title="1. Introduction">
          <p>
            Campify (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates campify.digital, a campus
            marketplace platform for UNILAG students. This Privacy Policy
            explains how we collect, use, store, and protect your personal
            information when you use our platform.
          </p>
          <p>
            By using Campify, you agree to the collection and use of your
            information as described in this policy.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <h3 className="font-semibold text-gray-900 dark:text-white mt-4">
            Information you provide directly
          </h3>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>
              Account information: full name, email address, phone number,
              username, password (securely hashed and never stored in plain text)
            </li>
            <li>Profile information: profile picture, bio, location on campus</li>
            <li>
              Seller verification data: UNILAG matric number, faculty/department,
              student ID card image, student portal screenshot
            </li>
            <li>Listing data: product photos, descriptions, prices, pickup locations</li>
            <li>Messages: communications between buyers and sellers</li>
            <li>Reviews and ratings</li>
            <li>Contact form submissions</li>
          </ul>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-4">
            Information collected automatically
          </h3>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Device and browser information</li>
            <li>IP address and approximate location</li>
            <li>Pages visited and interactions on our platform</li>
            <li>Authentication and activity logs</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>To create and manage your account</li>
            <li>To verify your student status (verification documents only)</li>
            <li>To display your listings to other users</li>
            <li>To facilitate communication between buyers and sellers</li>
            <li>
              To send transactional emails (account verification, listing
              approval, verification status updates)
            </li>
            <li>To send platform announcements and updates (you can opt out)</li>
            <li>To detect and prevent fraud, abuse, and violations of our Terms</li>
            <li>To improve our platform and user experience</li>
            <li>To comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. Verification Documents">
          <p>
            Student ID cards and portal screenshots submitted for seller
            verification are used solely for identity verification purposes.
            These documents:
          </p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Are stored securely using restricted-access cloud storage</li>
            <li>Are only accessible to Campify administrators</li>
            <li>Are never shared with other users, third parties, or advertisers</li>
            <li>Are retained for the duration of your active seller account</li>
            <li>Are deleted upon account deletion</li>
          </ul>
        </Section>

        <Section title="5. Sharing Your Information">
          <p>We do not sell your personal data. We share information only with:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>
              <strong>Cloudinary</strong> - for secure image storage (profile
              photos, listing photos, verification documents)
            </li>
            <li>
              <strong>Resend</strong> - for transactional and notification emails
            </li>
            <li>
              <strong>Supabase</strong> - for database hosting (secure cloud infrastructure with encryption at rest)
            </li>
            <li>
              <strong>Law enforcement</strong> - only when legally required to do so
            </li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Account data: retained while your account is active</li>
            <li>
              Verification documents: retained while your seller account is
              active, deleted within 30 days of account deletion
            </li>
            <li>Messages: retained for 12 months after last activity</li>
            <li>Logs: retained for 90 days</li>
          </ul>
        </Section>

        <Section title="7. Your Rights (NDPR & GDPR)">
          <p>You have the right to:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for non-essential data processing</li>
            <li>
              Lodge a complaint with the Nigeria Data Protection Commission
              (NDPC)
            </li>
          </ul>
          <p>
            To exercise any of these rights, email{" "}
            <a
              href={SUPPORT_MAILTO}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {SUPPORT_EMAIL || "our support team"}
            </a>{" "}
            with the subject &quot;Data Request&quot;.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Campify primarily uses essential cookies required for authentication,
            security, and core platform functionality.

            We do not currently use cookies for targeted advertising purposes.<br />
            Some third-party service providers may use limited analytics or
            security-related technologies necessary for platform operation.
          </p>
        </Section>

        <Section title="9. Security">
          <p>We implement industry-standard security measures including:</p>
          <ul className="list-disc list-outside ml-5 space-y-1">
            <li>Argon2 password hashing</li>
            <li>Secure authentication and session management</li>
            <li>HTTPS encryption for all data in transit</li>
            <li>Restricted access controls for sensitive verification documents</li>
            <li>Regular security reviews and monitoring</li>
          </ul>
        </Section>

        <Section title="10. Children's Privacy">
          <p>
            Campify is intended for university students. Some users may be under the
            age of 18 due to university admission requirements.<br />

            We take reasonable measures to protect the privacy and security of all
            users` personal information.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this policy periodically. We will notify users of
            significant changes via email. Continued use of Campify after
            changes constitutes acceptance.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>For privacy-related enquiries:</p>
          <div className="mt-3 space-y-2 text-sm">
            {SUPPORT_EMAIL && (
              <p className="flex items-center gap-2">
                <Mail size={16} className="text-blue-600 dark:text-blue-400" />
                <a
                  href={SUPPORT_MAILTO}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </p>
            )}
            <p className="flex items-center gap-2">
              <MapPin size={16} className="text-blue-600 dark:text-blue-400" />
              UNILAG Campus, Yaba, Lagos, Nigeria
            </p>
          </div>
        </Section>
      </article>

      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          See also our{" "}
          <Link
            href="/terms"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Terms of Use
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
