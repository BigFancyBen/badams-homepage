export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center">
        benadams.dev
      </h1>

      {/* Projects Section */}
             <div className="mt-16 w-full max-w-7xl">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
          Projects
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* MTG Commander Scorekeeper */}
          <a
            href="/commander"
            className="block border-2 border-gray-300 p-6 hover:border-black transition-colors cursor-pointer"
          >
            <h3 className="text-xl font-bold mb-3">
              MTG Commander Scorekeeper
            </h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              Full-screen, touch-friendly scorekeeper for Magic: The Gathering
              Commander format. Features 4-player quadrant layout, life
              tracking, commander damage, and mobile-optimized interface.
            </p>
            <div className="text-sm text-gray-500">Click to try it out →</div>
          </a>

          {/* Magic Tutor Helper */}
          <a
            href="/tutor-helper"
            className="block border-2 border-gray-300 p-6 hover:border-black transition-colors cursor-pointer"
          >
            <h3 className="text-xl font-bold mb-3">Magic Tutor Helper</h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              Advanced card filtering tool for Magic: The Gathering decklists.
              Import decklists, filter by mana cost and card types, and analyze
              your cards with Scryfall integration.
            </p>
            <div className="text-sm text-gray-500">Click to try it out →</div>
          </a>

          {/* Prognosticator */}
          <div className="border-2 border-gray-300 p-6 hover:border-black transition-colors">
            <h3 className="text-xl font-bold mb-3">Prognosticator</h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              Cross-platform desktop app for DJs and music curators. Import
              Spotify playlists, download songs, fetch DJ metadata (key, BPM),
              and integrate with VirtualDJ and OBS.
            </p>
            <div className="text-sm text-gray-500">
              Desktop App • VirtualDJ • OBS Integration
            </div>
          </div>

          {/* RuneScape Progress Image Generator */}
          <div className="border-2 border-gray-300 p-6 hover:border-black transition-colors">
            <h3 className="text-xl font-bold mb-3">
              RuneScape Progress Image Generator
            </h3>
            <p className="text-gray-700 mb-4 text-sm leading-relaxed">
              API endpoint for generating progress report images for Old School
              RuneScape players. Features collection log items, OSRS Wiki
              integration, and comprehensive game database.
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
