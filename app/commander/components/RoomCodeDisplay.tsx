"use client";

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';

interface RoomCodeDisplayProps {
  roomCode: string;
  showQR?: boolean;
  size?: 'small' | 'large';
}

export function RoomCodeDisplay({ roomCode, showQR = true, size = 'large' }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/commander/multiplayer?join=${roomCode}`;
    }
    return '';
  }, [roomCode]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [roomCode]);

  const qrCodeUrl = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size === 'large' ? '150x150' : '100x100'}&data=${encodeURIComponent(joinUrl)}&bgcolor=3a2942&color=fcf6b1`
    : '';

  const isLarge = size === 'large';

  return (
    <div className="bg-[#3a2942] border border-[#543f63] inline-block">
      {/* QR Code */}
      {showQR && joinUrl && (
        <div className={`border-b border-[#543f63] ${isLarge ? 'p-3' : 'p-2'}`}>
          <div className="text-[#8b7699] text-xs text-center mb-2">SCAN TO JOIN</div>
          <Image
            src={qrCodeUrl}
            alt="QR Code to join game"
            width={isLarge ? 150 : 100}
            height={isLarge ? 150 : 100}
            className="block mx-auto"
            unoptimized
          />
        </div>
      )}

      {/* Room Code with Copy Button */}
      <div className={`flex items-center justify-between ${isLarge ? 'px-4 py-3' : 'px-3 py-2'}`}>
        <div className="flex-1">
          <div className="text-[#8b7699] text-[10px] mb-0.5">ROOM CODE</div>
          <div className={`font-mono font-bold text-[#fcf6b1] tracking-widest ${isLarge ? 'text-2xl' : 'text-lg'}`} data-testid="room-code-display">
            {roomCode}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={`ml-3 bg-[#473455] hover:bg-[#5e4a6e] border border-[#614a71] transition-all flex items-center justify-center ${isLarge ? 'w-10 h-10' : 'w-8 h-8'}`}
          title={copied ? 'Copied!' : 'Copy room code'}
        >
          {copied ? (
            <svg
              width={isLarge ? 18 : 14}
              height={isLarge ? 18 : 14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a9e5bb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width={isLarge ? 18 : 14}
              height={isLarge ? 18 : 14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9d88aa"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="0" ry="0" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
