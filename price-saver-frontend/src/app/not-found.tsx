import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-2xl">PS</span>
        </div>
        <h1 className="text-title-md font-bold text-gray-900 dark:text-white mb-2">404</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
          Oops — this page doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-5 py-3 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
