//
// Tracks elapsed time since the game screen was opened, regardless of mode
// (Match / Unlimited / Train). Pure observer — no dependency on
// useSnookerGame's GameState, so it can never affect or be affected by the
// game reducer.
import { useEffect, useRef, useState } from 'react';

export function useSessionTimer(): { elapsedSeconds: number } {
  const startedAtRef = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { elapsedSeconds };
}

/** Formats a whole-second duration as "M:SS" or "H:MM:SS". Negative input clamps to 0. */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}
