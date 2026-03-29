"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

interface Step {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

interface HowItWorksAnimatedProps {
  steps: Step[];
}

export default function HowItWorksAnimated({ steps }: HowItWorksAnimatedProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 max-w-4xl mx-auto">
      {steps.map((s, index) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.step}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 text-center relative overflow-hidden"
          >
            {/* Watermark step number */}
            <span className="absolute -top-3 -right-1 text-8xl font-black text-gray-100 dark:text-gray-800 select-none pointer-events-none">
              {s.step}
            </span>

            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4 relative z-10">
              <Icon size={24} className="text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
            </div>

            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2 relative z-10">
              {s.title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed relative z-10">
              {s.description}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
