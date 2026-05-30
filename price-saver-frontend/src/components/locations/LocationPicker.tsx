/**
 * Seller-side multi-select for canonical UNILAG pickup locations.
 *
 * Layout: 5 collapsible parent groups, each with checkbox children.
 * Per-group "Select all" link. Top header shows total selected and
 * disables publish (handled by the parent form, not here) when zero.
 *
 * Pure presentational — receives `value` + `onChange` from the parent
 * form. Locations are fetched via the `useLocations()` hook so all
 * three consumers (picker, display, filter) share the same cached tree.
 */
"use client";

import { useState, useMemo } from "react";
import { ChevronDown, MapPin, Check } from "lucide-react";
import { useLocations, type LocationGroup } from "@/lib/locations";

interface LocationPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, render only error-state markup until at least one is picked. */
  required?: boolean;
  /** Optional className to position the outer wrapper. */
  className?: string;
}

export function LocationPicker({
  value,
  onChange,
  required = false,
  className = "",
}: LocationPickerProps) {
  const { groups, loading, error } = useLocations();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const valueSet = useMemo(() => new Set(value), [value]);
  const selectedCount = value.length;

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleChild = (child: string) => {
    if (valueSet.has(child)) {
      onChange(value.filter((v) => v !== child));
    } else {
      onChange([...value, child]);
    }
  };

  const allChildrenSelected = (g: LocationGroup) =>
    g.children.every((c) => valueSet.has(c));

  const someChildrenSelected = (g: LocationGroup) =>
    g.children.some((c) => valueSet.has(c));

  const selectAllInGroup = (g: LocationGroup) => {
    const merged = new Set(value);
    for (const c of g.children) merged.add(c);
    onChange(Array.from(merged));
  };

  const clearGroup = (g: LocationGroup) => {
    const childSet = new Set(g.children);
    onChange(value.filter((v) => !childSet.has(v)));
  };

  if (loading && groups.length === 0) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>Loading locations…</div>
    );
  }

  if (error && groups.length === 0) {
    return (
      <div className={`text-sm text-red-500 ${className}`}>
        Couldn’t load locations. Refresh the page or try again later.
      </div>
    );
  }

  const headerColor = required && selectedCount === 0 ? "text-red-500" : "text-brand-600 dark:text-brand-400";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${headerColor}`}>
          <MapPin size={12} className="inline mr-1" />
          {selectedCount === 0
            ? required
              ? "Pick at least one location"
              : "No locations selected"
            : `${selectedCount} location${selectedCount === 1 ? "" : "s"} selected`}
        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const isOpen = !!openGroups[g.key];
          const allOn = allChildrenSelected(g);
          const someOn = someChildrenSelected(g);
          const groupSelectedCount = g.children.filter((c) => valueSet.has(c)).length;
          return (
            <div
              key={g.key}
              className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleGroup(g.key)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors text-left"
                aria-expanded={isOpen}
              >
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">
                  {g.name}
                </span>
                {groupSelectedCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 ${
                      allOn
                        ? "bg-brand-500 text-white"
                        : "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
                    }`}
                  >
                    {allOn && <Check size={10} />}
                    {groupSelectedCount}/{g.children.length}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="px-3 pt-2 pb-3 space-y-1.5 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-end gap-2 text-xs pb-1">
                    <button
                      type="button"
                      onClick={() => selectAllInGroup(g)}
                      disabled={allOn}
                      className="text-brand-500 hover:underline disabled:text-gray-300 disabled:no-underline"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => clearGroup(g)}
                      disabled={!someOn}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-200"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {g.children.map((child) => {
                      const checked = valueSet.has(child);
                      return (
                        <label
                          key={child}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            checked
                              ? "bg-brand-50 dark:bg-brand-500/10"
                              : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleChild(child)}
                            className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          />
                          <span
                            className={`text-sm ${
                              checked
                                ? "text-brand-700 dark:text-brand-300 font-medium"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {child}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LocationPicker;
