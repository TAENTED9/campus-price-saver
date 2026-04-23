"use client";

/**
 * components/settings/SettingsToggle.tsx — Block 8
 *
 * Drop-in toggle that reads from and auto-syncs to the Zustand settings store.
 *
 * Usage (top-level key):
 *   <SettingsToggle settingKey="read_receipts" label="Read receipts" />
 *
 * Usage (nested key, e.g. notifications.email.messages):
 *   <SettingsToggle
 *     settingKey="messages"
 *     path={["notifications", "email", "messages"]}
 *     label="New message"
 *     sublabel="When a seller replies to you"
 *   />
 *
 * The `path` prop must be exactly 3 elements for notification toggles.
 * debounceMs defaults to 300ms — appropriate for toggle interactions.
 */

import { useSettingsStore, type UserSettingsState } from "@/stores/settingsStore";
import { useSettingsSync } from "@/hooks/useSettingsSync";

interface SettingsToggleProps {
  settingKey: string;
  label:      string;
  sublabel?:  string;
  /** Dot-path for nested keys, e.g. ["notifications", "email", "messages"] */
  path?:      [string, string, string];
  debounceMs?: number;
  disabled?:  boolean;
}

function _resolve(settings: UserSettingsState, path?: [string, string, string], key?: string): boolean {
  if (path) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let val: any = settings;
    for (const k of path) val = val?.[k];
    return Boolean(val);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Boolean((settings as any)[key!]);
}

function _buildPatch(
  value: boolean,
  path?: [string, string, string],
  key?: string,
): Partial<UserSettingsState> {
  if (path) {
    // Only 3-level nesting is supported (notifications.email|push.field)
    // Cast through unknown: the dynamic key structure is valid at runtime
    // but TypeScript cannot narrow it statically.
    return {
      notifications: {
        [path[1]]: { [path[2]]: value },
      },
    } as unknown as Partial<UserSettingsState>;
  }
  return { [key!]: value } as Partial<UserSettingsState>;
}

export function SettingsToggle({
  settingKey,
  label,
  sublabel,
  path,
  debounceMs = 300,
  disabled = false,
}: SettingsToggleProps) {
  const settings          = useSettingsStore((s) => s.settings);
  const { debouncedSync } = useSettingsSync();

  const value = settings ? _resolve(settings, path, settingKey) : false;

  const handleChange = (next: boolean) => {
    debouncedSync(_buildPatch(next, path, settingKey), debounceMs);
  };

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        {sublabel && (
          <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled || !settings}
        onClick={() => handleChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
          value
            ? "bg-blue-600"
            : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
