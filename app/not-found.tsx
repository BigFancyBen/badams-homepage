import Link from "next/link";

export default function NotFound() {
  return (
    <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="bg-[#2a2a2a] p-8 rounded-lg max-w-md mx-4 text-center">
        <h2 className="text-[#f5f5f5] text-2xl font-bold mb-4">
          Page Not Found
        </h2>
        <p className="text-[#cccccc] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold py-3 px-6 rounded-sm transition-all duration-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
