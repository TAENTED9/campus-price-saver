/**
 * Homepage / browse-page location filter.
 *
 * UX (per product owner):
 *   - 5 parent-zone chips shown by default.
 *   - Click a parent → that parent becomes active AND its child checkboxes
 *     expand inline beneath the chip row. Listings filter immediately to
 *     "any location in that parent" until the user refines via child ticks.
 *   - Multiple parents can be active simultaneously.
 *   - "Show all" pill clears the filter and shows everything (default state).
 *
 * `value` is the canonical-name array sent to the backend search endpoint.
 * The parent decides what to do with the change (push to URL, refetch, etc).
 */
"use client";

import { useState, useMemo } from "react";
import { MapPin, ChevronDown, X } from "lucide-react";
import { useLocations, type LocationGroup } from "@/lib/locations";

interface LocationFilterProps {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

function groupIsActive(group: LocationGroup, valueSet: Set<string>): boolean {
  return group.children.some((c) => valueSet.has(c));
}

function allInGroupSelected(group: LocationGroup, valueSet: Set<string>): boolean {
  return group.children.every((c) => valueSet.has(c));
}

export function LocationFilter({
  value,
  onChange,
  className = "",
}: LocationFilterProps) {
  const { groups, loading } = useLocations();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const valueSet = useMemo(() => new Set(value), [value]);

  if (loading && groups.length === 0) {
    return (
      <div className={`flex gap-2 flex-wrap ${className}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-9 w-32 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const onToggleParent = (g: LocationGroup) => {
    const wasActive = groupIsActive(g, valueSet);
    if (wasActive) {
      // Deactivating: remove all this group's children from the filter
      const childSet = new Set(g.children);
      onChange(value.filter((v) => !childSet.has(v)));
      if (expandedKey === g.key) setExpandedKey(null);
    } else {
      // Activating: select all children, expand inline
      const merged = new Set(value);
      for (const c of g.children) merged.add(c);
      onChange(Array.from(merged));
      setExpandedKey(g.key);
    }
  };

  const onToggleChild = (child: string) => {
    if (valueSet.has(child)) {
      onChange(value.filter((v) => v !== child));
    } else {
      onChange([...value, child]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setExpandedKey(null);
  };

  const expandedGroup = expandedKey
    ? groups.find((g) => g.key === expandedKey) ?? null
    : null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={clearAll}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors border ${
            value.length === 0
              ? "bg-brand-500 border-brand-500 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-brand-300"
          }`}
        >
          All locations
        </button>

        {groups.map((g) => {
          const isActive = groupIsActive(g, valueSet);
          const isExpanded = expandedKey === g.key;
          const selectedCount = g.children.filter((c) => valueSet.has(c)).length;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                if (isActive && !isExpanded) {
                  setExpandedKey(g.key);
                } else {
                  onToggleParent(g);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-brand-500 border-brand-500 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-brand-300"
              }`}
              aria-pressed={isActive}
            >
              <MapPin size={12} />
              {g.name}
              {isActive && selectedCount > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isExpanded ? "bg-white text-brand-600" : "bg-brand-700 text-white"
                  }`}
                >
                  {selectedCount}/{g.children.length}
                </span>
              )}
              <ChevronDown
                size={12}
                className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          );
        })}

        {value.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-red-500 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {expandedGroup && (
        <div className="rounded-2xl border border-brand-200 dark:border-brand-500/30 bg-brand-50/50 dark:bg-brand-500/[0.04] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">
              {expandedGroup.name}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  const merged = new Set(value);
                  for (const c of expandedGroup.children) merged.add(c);
                  onChange(Array.from(merged));
                }}
                disabled={allInGroupSelected(expandedGroup, valueSet)}
                className="text-brand-600 dark:text-brand-400 font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setExpandedKey(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Collapse"
              >
                <ChevronDown size={14} className="rotate-180" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
            {expandedGroup.children.map((child) => {
              const checked = valueSet.has(child);
              return (
                <label
                  key={child}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    checked
                      ? "bg-white dark:bg-gray-800 shadow-sm"
                      : "hover:bg-white/60 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleChild(child)}
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
}

export default LocationFilter;
