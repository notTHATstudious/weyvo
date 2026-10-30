import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';

interface Saved<T> { savedAt: number; data: T }

const PREFIX = 'weyvo-draft:';
const KEEP_FOR = 14 * 24 * 3600 * 1000;

/**
 * Keeps the text of a story being written in this browser, so a locked phone, a reload or a closed tab
 * doesn't lose it. Photos can't be kept this way and are picked again. Saved per account and per story;
 * cleared once the story is saved to Weyvo. Storage failures (private mode, full) are ignored.
 */
export function useAutosave<T>(name: string, snapshot: T) {
  const { user } = useAuth();
  const key = `${PREFIX}${user?.id ?? 'anon'}:${name}`;
  const initial = useRef(JSON.stringify(snapshot));
  const [offer, setOffer] = useState<Saved<T> | null>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const saved = JSON.parse(raw) as Saved<T>;
      if (Date.now() - saved.savedAt > KEEP_FOR || JSON.stringify(saved.data) === initial.current) return null;
      return saved;
    } catch {
      return null;
    }
  });

  const json = JSON.stringify(snapshot);
  useEffect(() => {
    // Nothing typed yet, or a restore is still on offer: don't overwrite what's kept.
    if (json === initial.current || offer) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: snapshot }));
      } catch {
        /* storage unavailable */
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, key, offer]);

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  };

  return {
    /** A kept draft to offer back, or null. */
    offer,
    /** Take the kept draft (the caller applies it) and keep autosaving from there. */
    accept: () => { const d = offer?.data ?? null; setOffer(null); return d; },
    discard: () => { clear(); setOffer(null); },
    clear,
  };
}
