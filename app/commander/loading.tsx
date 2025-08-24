export default function CommanderLoading() {
  return (
    <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#4ade80] mx-auto mb-6"></div>
        <div className="text-[#cccccc] text-xl font-medium">Loading Commander...</div>
        <div className="text-[#888888] text-sm mt-2">Setting up the battlefield</div>
      </div>
    </div>
  );
}
