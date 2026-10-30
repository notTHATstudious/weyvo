/**
 * BubDub's Atlas, Weyvo's trip-planning companion: its own web app, opened from Weyvo with the trip
 * filled in. Only place names, dates and a travel style go in the link.
 */
export const ATLAS_URL = ((import.meta.env.VITE_ATLAS_URL as string | undefined) ?? 'https://bubdub-s-atlas.onrender.com').replace(/\/+$/, '');

export type AtlasStyle = 'budget' | 'balanced' | 'premium';

export function atlasLink(trip: { to?: string; from?: string; depart?: string; ret?: string; style?: AtlasStyle; back?: string } = {}) {
  const q = new URLSearchParams({ ref: 'weyvo' });
  if (trip.to) q.set('to', trip.to.slice(0, 120));
  if (trip.from) q.set('from', trip.from.slice(0, 120));
  if (trip.depart) q.set('depart', trip.depart);
  if (trip.ret) q.set('return', trip.ret);
  if (trip.style) q.set('style', trip.style);
  // Where "Back to Weyvo" returns to: a path on Weyvo only.
  q.set('back', trip.back && trip.back.startsWith('/') && !trip.back.startsWith('//') ? trip.back : '/plan');
  return `${ATLAS_URL}/?${q.toString()}`;
}

/** YYYY-MM-DD, `days` from today. */
export function daysFromNow(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** A trip the length of a story's dates (or 3 days), starting two weeks from now. */
export function likeThisTrip(start?: string | null, end?: string | null) {
  const len = start && end ? Math.min(14, Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000))) : 3;
  const depart = daysFromNow(14);
  return { depart, ret: new Date(Date.parse(depart) + len * 86_400_000).toISOString().slice(0, 10) };
}

/** A finished Atlas plan sent to Weyvo's Create page, to start a full-trip story from. */
export interface AtlasStory {
  title: string;
  place: string;
  start: string | null;
  end: string | null;
  intro: string;
  sections: { heading: string; body: string }[];
}

const PREFILL = 'weyvo-atlas-prefill';
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * Reads a plan Atlas put after #atlas= (it never reaches a server) and keeps it for this tab, so it
 * survives a detour through sign-in. Treated as untrusted text: only known fields, trimmed to the limits.
 */
export function stashAtlasPrefill() {
  const m = /#atlas=([\w-]+)/.exec(window.location.hash);
  if (!m) return;
  try {
    const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as Record<string, unknown>;
    const sections = Array.isArray(raw.sections) ? raw.sections.slice(0, 8) : [];
    const story: AtlasStory = {
      title: str(raw.title, 60),
      place: str(raw.place, 120),
      start: date(raw.start),
      end: date(raw.end),
      intro: str(raw.intro, 250),
      sections: sections.map((s) => ({ heading: str((s as Record<string, unknown>)?.heading, 60), body: str((s as Record<string, unknown>)?.body, 500) }))
        .filter((s) => s.heading || s.body),
    };
    sessionStorage.setItem(PREFILL, JSON.stringify(story));
  } catch {
    /* not a valid plan: ignore it */
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function readAtlasPrefill(): AtlasStory | null {
  try {
    const raw = sessionStorage.getItem(PREFILL);
    return raw ? (JSON.parse(raw) as AtlasStory) : null;
  } catch {
    return null;
  }
}

/** Once used, the plan is forgotten so a later new story starts blank. */
export function forgetAtlasPrefill() {
  try {
    sessionStorage.removeItem(PREFILL);
  } catch {
    /* storage unavailable */
  }
}
