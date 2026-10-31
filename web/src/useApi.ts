import { useEffect, useState, type DependencyList } from 'react';
import { ApiError } from './api';

/**
 * The last result of each page query, kept for this tab. Going back to a page shows it at once while a
 * fresh copy loads quietly, instead of a blank skeleton every time. Cleared when the account changes.
 */
const recent = new Map<string, unknown>();
const MAX_RECENT = 60;

// A small copy is kept on the device too, so the app opens straight onto what you last saw even while the
// free server is still waking up. Capped at about 150 KB; cleared on sign-out or a different account.
const STORE = 'weyvo-pages';
const MAX_BYTES = 150_000;
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]') as [string, unknown][];
  saved.forEach(([k, v]) => recent.set(k, v));
} catch {
  /* nothing kept, or storage unavailable */
}
let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const entries = [...recent.entries()];
      let json = JSON.stringify(entries);
      // Newest entries are last; drop the oldest until it fits.
      while (json.length > MAX_BYTES && entries.length > 1) {
        entries.shift();
        json = JSON.stringify(entries);
      }
      localStorage.setItem(STORE, json.length > MAX_BYTES ? '[]' : json);
    } catch {
      /* storage full or unavailable */
    }
  }, 1000);
}

/** When each page query last came back from the server, so returning to the app can refresh stale ones. */
const fetchedAt = new Map<string, number>();
const STALE_AFTER = 30_000;
const refreshers = new Set<() => void>();
if (typeof document !== 'undefined') {
  // Coming back to the app (switching tabs or apps, unlocking the phone) or back online: quietly refresh what's on screen.
  const refreshAll = () => { if (document.visibilityState === 'visible') refreshers.forEach((r) => r()); };
  document.addEventListener('visibilitychange', refreshAll);
  window.addEventListener('online', refreshAll);
}

export function clearApiCache() {
  recent.clear();
  try {
    localStorage.removeItem(STORE);
  } catch {
    /* storage unavailable */
  }
  // Photos kept for offline belong to whoever was signed in too.
  if (typeof caches !== 'undefined') caches.delete('weyvo-photos').catch(() => undefined);
}

/** Loads data for a page; refetches when deps change and ignores responses that arrive after a newer request. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const key = load.toString() + JSON.stringify(deps);
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>(() =>
    recent.has(key) ? { data: recent.get(key) as T, error: null, loading: false } : { data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const refresh = () => { if (Date.now() - (fetchedAt.get(key) ?? 0) > STALE_AFTER) setAttempt((a) => a + 1); };
    refreshers.add(refresh);
    return () => { refreshers.delete(refresh); };
  }, [key]);

  useEffect(() => {
    let current = true;
    const cached = recent.has(key);
    // With a cached copy on screen, refresh in the background; otherwise show loading.
    setState(cached ? { data: recent.get(key) as T, error: null, loading: false } : (s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => {
        fetchedAt.set(key, Date.now());
        recent.delete(key);
        recent.set(key, data);
        if (recent.size > MAX_RECENT) recent.delete(recent.keys().next().value as string);
        persist();
        if (current) setState({ data, error: null, loading: false });
      },
      (error) => {
        // A failed background refresh keeps the cached copy rather than replacing it with an error.
        if (current && !cached) setState({ data: null, error: error instanceof ApiError ? error : new ApiError('Something went wrong', 0), loading: false });
      },
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
