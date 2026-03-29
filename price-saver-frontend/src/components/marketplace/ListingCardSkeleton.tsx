export default function ListingCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
      {/* Image placeholder */}
      <div className="h-44 bg-gray-200 dark:bg-gray-700 animate-pulse" />

      {/* Body */}
      <div className="p-3.5">
        {/* Title — two lines */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1.5" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />

        {/* Price */}
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-3" />

        {/* Seller */}
        <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-3" />
      </div>
    </div>
  );
}
