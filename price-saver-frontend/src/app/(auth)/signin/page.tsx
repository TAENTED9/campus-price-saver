import type { Metadata } from "next";
import { Suspense } from "react";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign In - Campify",
  description: "Sign in to your Campify account",
};

export default function SignInPage() {
  // SignInForm calls useSearchParams() (to read ?next=/redirect targets),
  // which forces client-side bailout during prerender. Next.js requires it
  // to sit inside a Suspense boundary or the static build of /signin fails.
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
