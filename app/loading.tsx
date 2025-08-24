export default function Loading() {
  return (
    <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4ade80] mx-auto mb-4"></div>
        <div className="text-[#cccccc] text-lg">Loading...</div>
      </div>
    </div>
  );
}
