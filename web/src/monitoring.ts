/**
 * Error reports to Sentry, only when VITE_SENTRY_DSN is set at build time. Loaded after the page is up,
 * so it never slows the first screen. No session replay, no user details; addresses lose their query
 * strings and story slugs (an unlisted story's address is its secret link).
 */

/** "/trips/goa-ab12cd34/edit?x" → "/trips/:slug/edit"; also /s/… share links and /api/trips|share/… calls. */
export function scrubUrl(url: string): string {
  return url
    .split(/[?#]/)[0]
    .replace(/(\/(?:api\/)?(?:trips|share)\/)(?!\d+(?:\/|$))[^/]+/g, '$1:slug')
    .replace(/(^|[^\w])(\/s\/)(?!u\/)[^/]+/g, '$1$2:slug');
}

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
          if (event.request?.url) event.request.url = scrubUrl(event.request.url);
          if (event.transaction) event.transaction = scrubUrl(event.transaction);
          return event;
        },
        beforeBreadcrumb(crumb) {
          const d = crumb.data as Record<string, unknown> | undefined;
          if (d) for (const k of ['url', 'from', 'to']) if (typeof d[k] === 'string') d[k] = scrubUrl(d[k] as string);
          if (crumb.message) crumb.message = crumb.message.replace(/\/(?:api\/)?(?:trips|share|s)\/[^\s"')]+/g, (m) => scrubUrl(m));
          return crumb;
        },
      }),
    );
  if ('requestIdleCallback' in window) window.requestIdleCallback(() => void start(), { timeout: 3000 });
  else setTimeout(() => void start(), 1500);
}
