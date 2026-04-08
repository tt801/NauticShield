import { useEffect, useRef } from 'react';
import { useClerk, useAuth } from '@clerk/clerk-react';

// Timeout in ms per role — stricter for lower-privilege roles
const TIMEOUT_MS: Record<string, number> = {
  owner:   30 * 60 * 1000,  // 30 minutes
  captain: 30 * 60 * 1000,  // 30 minutes
  it_tech: 20 * 60 * 1000,  // 20 minutes
  crew:    10 * 60 * 1000,  // 10 minutes
};
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

const EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click',
];

export function useInactivityLogout(role?: string) {
  const { signOut }  = useClerk();
  const { isSignedIn } = useAuth();
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    const timeout = TIMEOUT_MS[role ?? ''] ?? DEFAULT_TIMEOUT_MS;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut();
      }, timeout);
    }

    reset(); // start on mount
    EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(e => document.removeEventListener(e, reset));
    };
  }, [isSignedIn, role, signOut]);
}
