export default function CommanderLoading() {
  return (
    <div className="w-screen h-screen bg-[#2d1e2f] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#a9e5bb] mx-auto mb-6"></div>
        <div className="text-[#d4ca88] text-xl font-medium">Loading Commander...</div>
        <div className="text-[#8b7699] text-sm mt-2">Setting up the battlefield</div>
      </div>
    </div>
  );
}
