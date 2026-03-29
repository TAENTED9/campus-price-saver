import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-2xl">C</span>
        </div>
        <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-3">404</h1>
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
          Page not found
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-5 py-3 text-sm font-semibold text-white bg-brand-500 rounded-xl hover:bg-brand-600 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
