import * as Sentry from '@sentry/node';

let initialised = false;

export function initSentry(): void {
  if (initialised || !process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn:         process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
  initialised = true;
}

export { Sentry };
