import { useState } from 'react';

/**
 * Runs `reset` once each time `open` turns true, during render (React's "adjust state when a prop changes" pattern),
 * so a dialog starts from the server's current values every time it opens without an effect that would also fire on
 * a background re-read.
 */
export function useResetOnOpen(open: boolean, reset: () => void): void {
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reset();
  }
}
