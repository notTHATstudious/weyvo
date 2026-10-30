import { useEffect, useState, type DependencyList } from 'react';
import { ApiError } from './api';

/**
 * The last result of each page query, kept for this tab. Going back to a page shows it at once while a
 * fresh copy loads quietly, instead of a blank skeleton every time. Cleared when the account changes.
 */
const recent = new Map<string, unknown>();
const MAX_RECENT = 60;

export function clearApiCache() {
  recent.clear();
}

/** Loads data for a page; refetches when deps change and ignores responses that arrive after a newer request. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const key = load.toString() + JSON.stringify(deps);
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>(() =>
    recent.has(key) ? { data: recent.get(key) as T, error: null, loading: false } : { data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const cached = recent.has(key);
    // With a cached copy on screen, refresh in the background; otherwise show loading.
    setState(cached ? { data: recent.get(key) as T, error: null, loading: false } : (s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => {
        recent.delete(key);
        recent.set(key, data);
        if (recent.size > MAX_RECENT) recent.delete(recent.keys().next().value as string);
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
