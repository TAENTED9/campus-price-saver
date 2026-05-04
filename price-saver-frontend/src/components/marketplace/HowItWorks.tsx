"use client";

import { Package, MessageCircle, CheckCircle } from "lucide-react";
import HowItWorksAnimated from "./HowItWorksAnimated";

const STEPS = [
  {
    step: "01",
    icon: Package,
    title: "List Your Item",
    description:
      "Post what you're selling in under 2 minutes. Add photos, set your price, choose a pickup spot.",
  },
  {
    step: "02",
    icon: MessageCircle,
    title: "Meet Your Buyer",
    description:
      "Chat safely on-platform. Pick a familiar UNILAG spot — SUB, GTBank bus stop, your faculty gate.",
  },
  {
    step: "03",
    icon: CheckCircle,
    title: "Complete the Deal",
    description:
      "Exchange cash or transfer. Mark as sold. Leave a review. Build your seller reputation.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 bg-white dark:bg-gray-900 mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight text-center">
          How Campify Works
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mt-2 text-sm">
          Buy and sell within the UNILAG community — safely.
        </p>

        <HowItWorksAnimated steps={STEPS} />
      </div>
    </section>
  );
}
