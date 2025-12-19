"use client";

import { useState, useEffect, useCallback } from 'react';

interface RoomCodeDisplayProps {
  roomCode: string;
  showQR?: boolean;
  size?: 'small' | 'large';
}

export function RoomCodeDisplay({ roomCode, showQR = true, size = 'large' }: RoomCodeDisplayProps) {
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/commander/multiplayer?join=${roomCode}`;
      setJoinUrl(url);
    }
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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size === 'large' ? '150x150' : '100x100'}&data=${encodeURIComponent(joinUrl)}&bgcolor=222222&color=ffffff`
    : '';

  const isLarge = size === 'large';

  return (
    <div className="bg-[#222222] border border-[#333333] inline-block">
      {/* QR Code */}
      {showQR && joinUrl && (
        <div className={`border-b border-[#333333] ${isLarge ? 'p-3' : 'p-2'}`}>
          <div className="text-[#888888] text-xs text-center mb-2">SCAN TO JOIN</div>
          <img
            src={qrCodeUrl}
            alt="QR Code to join game"
            width={isLarge ? 150 : 100}
            height={isLarge ? 150 : 100}
            className="block mx-auto"
          />
        </div>
      )}

      {/* Room Code with Copy Button */}
      <div className={`flex items-center justify-between ${isLarge ? 'px-4 py-3' : 'px-3 py-2'}`}>
        <div className="flex-1">
          <div className="text-[#888888] text-[10px] mb-0.5">ROOM CODE</div>
          <div className={`font-mono font-bold text-[#ffffff] tracking-widest ${isLarge ? 'text-2xl' : 'text-lg'}`}>
            {roomCode}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className={`ml-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#404040] transition-all flex items-center justify-center ${isLarge ? 'w-10 h-10' : 'w-8 h-8'}`}
          title={copied ? 'Copied!' : 'Copy room code'}
        >
          {copied ? (
            <svg
              width={isLarge ? 18 : 14}
              height={isLarge ? 18 : 14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
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
              stroke="#a3a3a3"
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
