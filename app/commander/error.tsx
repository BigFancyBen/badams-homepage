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
    <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="bg-[#2a2a2a] p-8 rounded-lg max-w-md mx-4 text-center">
        <h2 className="text-[#f5f5f5] text-2xl font-bold mb-4">
          Commander Error
        </h2>
        <p className="text-[#cccccc] mb-6">
          Something went wrong with the Commander page. This might be due to a loading issue or browser compatibility.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold py-3 px-6 rounded transition-all duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="w-full bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5] font-bold py-3 px-6 rounded transition-all duration-200"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
