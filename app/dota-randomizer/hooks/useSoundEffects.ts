"use client";

import { useRef, useCallback, useEffect } from "react";

interface SoundEffects {
  playTick: () => void;
  playDing: () => void;
  playFanfare: () => void;
  cleanup: () => void;
}

export function useSoundEffects(): SoundEffects {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext lazily (must be triggered by user interaction)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    // Resume if suspended (browsers require user interaction)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Tick sound - short click for wheel spinning
  const playTick = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        400,
        ctx.currentTime + 0.05
      );

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio may not be available
    }
  }, [getAudioContext]);

  // Ding sound - pleasant chime for selection complete
  const playDing = useCallback(() => {
    try {
      const ctx = getAudioContext();

      // Create two oscillators for a richer sound
      const frequencies = [880, 1320]; // A5 and E6 (perfect fifth)

      frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + i * 0.05;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.5);
      });
    } catch {
      // Audio may not be available
    }
  }, [getAudioContext]);

  // Fanfare sound - celebratory ascending notes
  const playFanfare = useCallback(() => {
    try {
      const ctx = getAudioContext();

      // Ascending fanfare notes (C major arpeggio with triumph ending)
      const notes = [
        { freq: 523.25, time: 0, duration: 0.15 }, // C5
        { freq: 659.25, time: 0.1, duration: 0.15 }, // E5
        { freq: 783.99, time: 0.2, duration: 0.15 }, // G5
        { freq: 1046.5, time: 0.3, duration: 0.4 }, // C6 (longer)
        { freq: 1318.51, time: 0.35, duration: 0.4 }, // E6 (harmony)
      ];

      notes.forEach(({ freq, time, duration }) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time);

        const startTime = ctx.currentTime + time;
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gainNode.gain.setValueAtTime(0.25, startTime + duration * 0.7);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          startTime + duration
        );

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });

      // Add a subtle bass note for depth
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();

      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);

      bassOsc.type = "sine";
      bassOsc.frequency.setValueAtTime(130.81, ctx.currentTime + 0.3); // C3

      bassGain.gain.setValueAtTime(0, ctx.currentTime + 0.3);
      bassGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.32);
      bassGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      bassOsc.start(ctx.currentTime + 0.3);
      bassOsc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio may not be available
    }
  }, [getAudioContext]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { playTick, playDing, playFanfare, cleanup };
}
