function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

export function SellerCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]">
      <Pulse className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-3 w-24" />
      </div>
      <Pulse className="h-7 w-20 rounded-lg" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Pulse className="h-4 w-20" />
        </td>
      ))}
    </tr>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <Pulse className="mb-3 h-10 w-10 rounded-xl" />
      <Pulse className="mb-2 h-4 w-24" />
      <Pulse className="mb-1 h-7 w-14" />
      <Pulse className="h-3 w-16" />
    </div>
  );
}
