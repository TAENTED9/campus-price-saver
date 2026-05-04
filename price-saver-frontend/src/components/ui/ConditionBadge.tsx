import React from "react";

type ConditionValue = string;

const CONDITION_MAP: Record<string, string> = {
  new:         "bg-success-500 text-white",
  "like-new":  "bg-success-500 text-white",
  good:        "bg-warning-500 text-white",
  fair:        "bg-warning-500 text-white",
  fairly_used: "bg-warning-500 text-white",
  used:        "bg-gray-400 text-white",
  poor:        "bg-gray-400 text-white",
  New:         "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400",
  "Fairly Used": "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
  Used:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const CONDITION_LABEL: Record<string, string> = {
  new:         "New",
  "like-new":  "Like New",
  good:        "Good",
  fair:        "Fair",
  fairly_used: "Fairly Used",
  used:        "Used",
  poor:        "Poor",
};

interface ConditionBadgeProps {
  condition: ConditionValue;
  className?: string;
}

export function ConditionBadge({ condition, className = "" }: ConditionBadgeProps) {
  const colorClass = CONDITION_MAP[condition] ?? CONDITION_MAP["used"];
  const label = CONDITION_LABEL[condition] ?? condition;
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}

export default ConditionBadge;
