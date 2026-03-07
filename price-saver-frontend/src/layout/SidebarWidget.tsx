import React from "react";

export default function SidebarWidget() {
  return (
    <div className="mx-auto mb-10 w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/[0.03]">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-500/20">
        <span className="text-lg">🛡️</span>
      </div>
      <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
        UnilagSave Admin
      </h3>
      <p className="mb-4 text-gray-500 text-theme-sm dark:text-gray-400">
        Platform manager portal. Review verifications and keep the marketplace safe.
      </p>
      <a
        href="/verification/pending"
        className="flex items-center justify-center p-3 font-medium text-white rounded-lg bg-brand-500 text-theme-sm hover:bg-brand-600"
      >
        Review Queue
      </a>
    </div>
  );
}
