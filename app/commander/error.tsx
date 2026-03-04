"use client";

import { useEffect } from "react";

export default function CommanderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Commander page error:", error);
  }, [error]);

  return (
    <div className="w-screen h-screen bg-[#2d1e2f] flex items-center justify-center">
      <div className="bg-[#473455] p-8 rounded-lg max-w-md mx-4 text-center">
        <h2 className="text-[#fcf6b1] text-2xl font-bold mb-4">
          Commander Error
        </h2>
        <p className="text-[#d4ca88] mb-6">
          Something went wrong with the Commander page. This might be due to a loading issue or browser compatibility.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-[#a9e5bb] hover:bg-[#89d4a0] text-black font-bold py-3 px-6 rounded-sm transition-all duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="w-full bg-[#614a71] hover:bg-[#6e5580] text-[#e8e0a0] font-bold py-3 px-6 rounded-sm transition-all duration-200"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
