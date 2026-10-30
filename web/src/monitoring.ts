/**
 * Error reports to Sentry, only when VITE_SENTRY_DSN is set at build time. Loaded after the page is up,
 * so it never slows the first screen. No session replay, no user details; URLs lose their query strings.
 */
export function startMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  const start = () =>
    import('@sentry/react').then((Sentry) =>
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0,
        beforeSend(event) {
          if (event.request?.url) event.request.url = event.request.url.split('?')[0];
          return event;
        },
      }),
    );
  if ('requestIdleCallback' in window) window.requestIdleCallback(() => void start(), { timeout: 3000 });
  else setTimeout(() => void start(), 1500);
}
