type StatusBadgeProps = {
  status: string;
  className?: string;
};

const STATUS_MAP: Record<string, string> = {
  active:       "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  approved:     "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  verified:     "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  open:         "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  resolved:     "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
  completed:    "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
  pending:      "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  under_review: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  limited:      "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  suspended:    "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  paused:       "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  rejected:     "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
  banned:       "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
  flagged:      "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
  removed:      "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
  dismissed:    "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
  inactive:     "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
  closed:       "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
  deleted:      "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
};

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colorCls = STATUS_MAP[status.toLowerCase()] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorCls} ${className}`}
    >
      {label}
    </span>
  );
}
