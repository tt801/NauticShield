import { useEffect, useRef } from 'react';

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only activate when a role is provided (i.e. user is signed in)
    if (!role) return;

    const timeout = TIMEOUT_MS[role] ?? DEFAULT_TIMEOUT_MS;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Redirect to sign-in; Clerk will handle the session on that page
        window.location.href = '/sign-in';
      }, timeout);
    }

    reset(); // start on mount
    EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(e => document.removeEventListener(e, reset));
    };
  }, [role]);
}
