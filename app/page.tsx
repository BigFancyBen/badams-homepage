export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center">benadams.dev</h1>

      {/* Featured Project */}
      <div className="mt-8">
        <a
          href="/commander"
          className="inline-block px-6 py-3 border-2 border-black hover:bg-black hover:text-white transition-colors text-lg font-medium cursor-pointer underline hover:no-underline"
        >
          MTG Commander Scorekeeper
        </a>
      </div>

      {/* Projects Section */}
      <div className="mt-16 w-full max-w-4xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Projects</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* MTG Commander Scorekeeper */}
          <div className="border-2 border-gray-300 p-6 hover:border-black transition-colors">
            <h3 className="text-xl font-bold mb-3">MTG Commander Scorekeeper</h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              A full-screen, touch-friendly scorekeeper application for Magic: The Gathering Commander format. 
              Features 4-player quadrant layout, life tracking, commander damage tracking, poison counters, 
              persistent game state, and mobile-optimized interface with rotating quadrants.
            </p>
            <a 
              href="/commander" 
              className="inline-block px-4 py-2 border border-black hover:bg-black hover:text-white transition-colors text-sm font-medium"
            >
              Try it out →
            </a>
          </div>

          {/* Prognosticator */}
          <div className="border-2 border-gray-300 p-6 hover:border-black transition-colors">
            <h3 className="text-xl font-bold mb-3">Prognosticator</h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              Cross-platform desktop app for DJs and music curators. Import playlists from Spotify, 
              download and manage songs, automatically fetch DJ metadata (key, BPM, key color), 
              and integrate with VirtualDJ and OBS for seamless DJ and streaming workflow.
            </p>
            <div className="text-sm text-gray-500">
              Desktop App • VirtualDJ • OBS Integration
            </div>
          </div>

          {/* RuneScape Progress Image Generator */}
          <div className="border-2 border-gray-300 p-6 hover:border-black transition-colors">
            <h3 className="text-xl font-bold mb-3">RuneScape Progress Image Generator</h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              Modern API endpoint for generating progress report images for Old School RuneScape players. 
              Features collection log items, direct OSRS Wiki integration, comprehensive database of items 
              and monsters, and incremental updates for current game data.
            </p>
            <div className="text-sm text-gray-500">
              API • OSRS Wiki • Image Generation
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
