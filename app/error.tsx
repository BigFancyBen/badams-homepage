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
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="bg-[#2a2a2a] p-8 rounded-lg max-w-md mx-4 text-center">
        <h2 className="text-[#f5f5f5] text-2xl font-bold mb-4">
          Something went wrong!
        </h2>
        <p className="text-[#cccccc] mb-6">
          An error occurred while loading the page. Please try again.
        </p>
        <button
          onClick={reset}
          className="bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold py-3 px-6 rounded-sm transition-all duration-200"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
