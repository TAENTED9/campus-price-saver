import type { Metadata } from "next";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign In - Campify",
  description: "Sign in to your Campify account",
};

export default function SignInPage() {
  return <SignInForm />;
}
