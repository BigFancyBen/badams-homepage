export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-center">benadams.dev</h1>

      <div className="mt-8">
        <a
          href="/commander"
          className="inline-block px-6 py-3 border-2 border-black hover:bg-black hover:text-white transition-colors text-lg font-medium cursor-pointer underline hover:no-underline"
        >
          MTG Commander Scorekeeper
        </a>
      </div>
    </div>
  );
}
