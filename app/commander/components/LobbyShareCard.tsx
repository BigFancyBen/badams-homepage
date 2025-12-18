"use client";

import { useState, useCallback } from "react";

interface LobbyShareCardProps {
  lobbyCode: string;
  size?: "compact" | "medium" | "large";
  showUrl?: boolean;
  className?: string;
}

export function LobbyShareCard({
  lobbyCode,
  size = "medium",
  showUrl = true,
  className = "",
}: LobbyShareCardProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/commander/lobby/${lobbyCode}/join`
    : `/commander/lobby/${lobbyCode}/join`;

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.host}/commander`
    : "yoursite.com/commander";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [joinUrl]);

  // Size-based styling
  const sizeStyles = {
    compact: {
      container: "p-3",
      qrSize: 100,
      codeText: "text-lg",
      cellSize: "w-6 h-8",
      labelText: "text-xs",
      urlText: "text-[10px]",
      buttonText: "text-xs px-2 py-1",
    },
    medium: {
      container: "p-4",
      qrSize: 150,
      codeText: "text-xl",
      cellSize: "w-8 h-10",
      labelText: "text-sm",
      urlText: "text-xs",
      buttonText: "text-sm px-3 py-2",
    },
    large: {
      container: "p-6",
      qrSize: 200,
      codeText: "text-2xl",
      cellSize: "w-10 h-12",
      labelText: "text-base",
      urlText: "text-sm",
      buttonText: "text-base px-4 py-2",
    },
  };

  const styles = sizeStyles[size];

  // Generate QR code URL using a public QR code API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${styles.qrSize}x${styles.qrSize}&data=${encodeURIComponent(joinUrl)}&bgcolor=2a2a2a&color=ffffff&format=svg`;

  return (
    <div
      className={`bg-[#2a2a2a] border border-[#3a3a3a] ${styles.container} ${className}`}
    >
      {/* QR Code */}
      <div className="flex justify-center mb-4">
        <div
          className="bg-[#2a2a2a] flex items-center justify-center"
          style={{ width: styles.qrSize, height: styles.qrSize }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt="QR Code to join lobby"
            width={styles.qrSize}
            height={styles.qrSize}
            className="block"
          />
        </div>
      </div>

      {/* Label */}
      <div className={`text-center text-[#a3a3a3] ${styles.labelText} mb-3 font-semibold tracking-wide`}>
        JOIN WITH CODE
      </div>

      {/* Lobby Code Display */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex gap-1">
          {lobbyCode.split("").map((char, index) => (
            <div
              key={index}
              className={`${styles.cellSize} bg-[#333333] border border-[#404040] flex items-center justify-center font-mono font-bold text-[#f5f5f5] ${styles.codeText}`}
            >
              {char}
            </div>
          ))}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`${styles.buttonText} font-bold transition-all duration-200 flex items-center gap-1 ${
            copied
              ? "bg-[#166534] text-white"
              : "bg-[#404040] hover:bg-[#4a4a4a] text-[#e5e5e5]"
          }`}
        >
          {copied ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
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
              Copy
            </>
          )}
        </button>
      </div>

      {/* URL Hint */}
      {showUrl && (
        <div className={`text-center text-[#666666] ${styles.urlText}`}>
          {baseUrl}
        </div>
      )}
    </div>
  );
}
