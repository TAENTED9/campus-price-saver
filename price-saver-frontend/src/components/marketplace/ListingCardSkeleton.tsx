export default function ListingCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 h-full flex flex-col">
      {/* Image placeholder — matches the 4:3 ratio used by the real card so
          there's no layout jump when the data resolves. */}
      <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title — two lines, matches min-h-[2.6em] reservation in real card */}
        <div className="space-y-1.5 min-h-[2.6em]">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        </div>

        {/* Price */}
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-3" />

        {/* Seller */}
        <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-3" />

        {/* Bottom row spacer (anchored to foot) */}
        <div className="mt-auto pt-2 h-3" />
      </div>
    </div>
  );
}
