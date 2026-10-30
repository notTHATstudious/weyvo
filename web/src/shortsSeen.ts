import { useEffect, useState } from 'react';
import { api } from './api';

/**
 * Whether there are short stories newer than the last time this reader opened Short Stories.
 * Checked at most every few minutes for the whole app, so moving between pages costs nothing.
 */
const KEY = 'weyvo-shorts-seen';
const CHECK_EVERY = 3 * 60 * 1000;
let latest: { at: number; checked: number; author: string | null } | null = null;
const listeners = new Set<() => void>();

function seenAt(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return 0;
  }
}

/** Called when Short Stories opens: everything up to now has been seen. */
export function markShortsSeen() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useNewShorts(me: string | undefined): boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    if (!latest || Date.now() - latest.checked > CHECK_EVERY) {
      api.feed('SHORT').then(
        (cards) => {
          const top = cards[0];
          latest = { at: top?.publishedAt ? Date.parse(top.publishedAt) : 0, checked: Date.now(), author: top?.author.username ?? null };
          listeners.forEach((fn) => fn());
        },
        () => undefined,
      );
    }
    return () => { listeners.delete(l); };
  }, []);
  // Your own new story isn't news to you.
  return !!latest && latest.at > seenAt() && latest.author !== me;
}
