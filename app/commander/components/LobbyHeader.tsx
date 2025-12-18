"use client";

import { useState, useCallback } from "react";

interface LobbyHeaderProps {
  lobbyCode: string;
  connectedCount: number;
  maxPlayers: number;
  className?: string;
}

export function LobbyHeader({
  lobbyCode,
  connectedCount,
  maxPlayers,
  className = "",
}: LobbyHeaderProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/commander/lobby/${lobbyCode}/join`
    : `/commander/lobby/${lobbyCode}/join`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [joinUrl]);

  return (
    <div
      className={`bg-[#222222] border-b border-[#333333] px-4 py-2 flex items-center justify-between ${className}`}
    >
      {/* Lobby Code */}
      <div className="flex items-center gap-2">
        <span className="text-[#888888] text-sm font-semibold">LOBBY:</span>
        <span className="text-[#f5f5f5] font-mono font-bold tracking-wider">
          {lobbyCode}
        </span>
        <button
          onClick={handleCopy}
          className={`p-1 transition-all duration-200 ${
            copied
              ? "text-[#22c55e]"
              : "text-[#888888] hover:text-[#cccccc]"
          }`}
          title={copied ? "Copied!" : "Copy join link"}
        >
          {copied ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>

      {/* Player Count */}
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#888888]"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span
          className={`font-bold ${
            connectedCount === maxPlayers
              ? "text-[#22c55e]"
              : "text-[#888888]"
          }`}
        >
          {connectedCount}/{maxPlayers}
        </span>
      </div>
    </div>
  );
}
