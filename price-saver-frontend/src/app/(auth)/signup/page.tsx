import type { Metadata } from "next";
import SignUpForm from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Create Account — Campify",
  description: "Join Campify and start saving money on campus",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
