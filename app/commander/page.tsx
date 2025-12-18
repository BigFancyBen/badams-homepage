"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateLobbyCode, isValidLobbyCode } from "./types";

export default function CommanderLandingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleCreateLobby = () => {
    setIsCreating(true);
    const code = generateLobbyCode();
    // Store player count preference for the lobby
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`lobby-${code}-playerCount`, playerCount.toString());
      sessionStorage.setItem(`lobby-${code}-isHost`, "true");
    }
    router.push(`/commander/lobby/${code}`);
  };

  const handleJoinLobby = () => {
    const code = joinCode.toUpperCase().trim();

    if (!code) {
      setJoinError("Please enter a lobby code");
      return;
    }

    if (!isValidLobbyCode(code)) {
      setJoinError("Invalid lobby code format");
      return;
    }

    setJoinError("");
    router.push(`/commander/lobby/${code}/join`);
  };

  const handleLocalMode = () => {
    router.push("/commander/local");
  };

  const handleCodeChange = (value: string) => {
    // Only allow valid characters and uppercase
    const filtered = value
      .toUpperCase()
      .replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, "")
      .slice(0, 6);
    setJoinCode(filtered);
    setJoinError("");
  };

  if (!isClient) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc] text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#f5f5f5] mb-2 tracking-wide">
            COMMANDER
          </h1>
          <p className="text-[#888888] text-sm">
            Life Tracker for Magic: The Gathering
          </p>
        </div>

        {/* Create Lobby Section */}
        <div className="bg-[#222222] border border-[#333333] p-6 mb-4">
          <h2 className="text-lg font-bold text-[#f5f5f5] mb-4 tracking-wide">
            CREATE LOBBY
          </h2>
          <p className="text-[#888888] text-sm mb-4">
            Host a multiplayer game. Share the code with others to join.
          </p>

          {/* Player Count Selector */}
          <div className="mb-4">
            <label className="text-[#a3a3a3] text-sm font-semibold mb-2 block">
              Number of Players:
            </label>
            <div className="flex gap-2">
              {([2, 3, 4] as const).map((count) => (
                <button
                  key={count}
                  onClick={() => setPlayerCount(count)}
                  className={`flex-1 py-2 font-bold text-sm transition-all duration-200 ${
                    playerCount === count
                      ? "bg-[#166534] text-white"
                      : "bg-[#2a2a2a] text-[#888888] hover:bg-[#333333] hover:text-[#cccccc]"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateLobby}
            disabled={isCreating}
            className="w-full bg-[#166534] hover:bg-[#14532d] active:bg-[#052e16] disabled:bg-[#14532d] disabled:opacity-50 text-white font-bold py-3 px-4 transition-all duration-200"
          >
            {isCreating ? "Creating..." : "Create Lobby"}
          </button>
        </div>

        {/* Join Lobby Section */}
        <div className="bg-[#222222] border border-[#333333] p-6 mb-4">
          <h2 className="text-lg font-bold text-[#f5f5f5] mb-4 tracking-wide">
            JOIN LOBBY
          </h2>
          <p className="text-[#888888] text-sm mb-4">
            Enter a 6-character code to join an existing game.
          </p>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoinLobby();
              }}
              placeholder="ABC123"
              maxLength={6}
              className="flex-1 bg-[#2a2a2a] text-[#f5f5f5] border border-[#404040] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30 focus:outline-none transition-all duration-200 px-4 py-3 text-center font-mono font-bold text-xl tracking-[0.3em] uppercase"
            />
            <button
              onClick={handleJoinLobby}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white font-bold py-3 px-6 transition-all duration-200"
            >
              Join
            </button>
          </div>

          {joinError && (
            <p className="text-[#dc2626] text-sm mt-2">{joinError}</p>
          )}
        </div>

        {/* Local Mode Section */}
        <div className="bg-[#222222] border border-[#333333] p-6">
          <h2 className="text-lg font-bold text-[#f5f5f5] mb-4 tracking-wide">
            LOCAL MODE
          </h2>
          <p className="text-[#888888] text-sm mb-4">
            Single device mode. All players share one screen.
          </p>

          <button
            onClick={handleLocalMode}
            className="w-full bg-[#404040] hover:bg-[#4a4a4a] active:bg-[#333333] text-[#e5e5e5] font-bold py-3 px-4 transition-all duration-200"
          >
            Start Local Game
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-[#666666] text-xs">
            Multiplayer requires all players to have internet access
          </p>
        </div>
      </div>
    </div>
  );
}
