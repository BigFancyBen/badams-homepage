"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("FloatWise error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
          Something went wrong!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          There was an error loading the weather data. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
