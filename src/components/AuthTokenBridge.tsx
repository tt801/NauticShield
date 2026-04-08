import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenProvider } from '@/api/client';

/**
 * Mounts inside ClerkProvider. Registers a token provider so that
 * every agentApi call automatically gets a fresh Bearer token.
 * Renders nothing — side-effect only.
 */
export function AuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenProvider(() => getToken());
    return () => setTokenProvider(() => Promise.resolve(null));
  }, [getToken]);

  return null;
}
