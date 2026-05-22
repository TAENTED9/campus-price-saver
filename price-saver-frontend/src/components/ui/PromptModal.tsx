"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  required?: boolean;
  loading?: boolean;
  multiline?: boolean;
}

export default function PromptModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  required = false,
  loading = false,
  multiline = false,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  const confirmCls =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600 focus:ring-red-500/30"
      : "bg-brand-500 hover:bg-brand-600 focus:ring-brand-500/30";

  const canSubmit = !loading && (!required || value.trim().length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      {description && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
      {label && (
        <label className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          rows={3}
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          className="mb-5 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-400 focus:outline-none disabled:opacity-50 resize-none"
        />
      ) : (
        <input
          type="text"
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) onSubmit(value);
          }}
          className="mb-5 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-400 focus:outline-none disabled:opacity-50"
        />
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => onSubmit(value)}
          disabled={!canSubmit}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 ${confirmCls}`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Loading…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
