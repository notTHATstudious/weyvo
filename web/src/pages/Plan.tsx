import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ATLAS_URL, atlasLink } from '../atlas';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Pin } from '../components/Wordmark';
import { useApi } from '../useApi';

/** BubDub's Atlas page colours, so the planner sits on the same background as Weyvo around it. */
const ATLAS_BG = { light: '#F4EEE9', dark: '#14110F' } as const;

/**
 * The Plan tab: BubDub's Atlas running inside Weyvo, like a mini-app. The planner and its results show
 * right here, in Atlas's own look; Atlas is also its own app, which this page offers to install.
 * ?to=, ?depart= and ?return= (from a story or destination) fill the trip in.
 */
export function Plan() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const theme: 'light' | 'dark' = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const [showInstall, setShowInstall] = useState(false);
  const want = useApi(() => (user ? api.myList('want') : Promise.resolve([])), [user?.id]);
  const popular = useApi(() => api.places(), []);

  const to = params.get('to') ?? '';
  const ideas = [...new Set([
    ...(want.data ?? []).map((t) => t.place.split(',')[0].trim()),
    ...(popular.data ?? []).map((p) => p.name),
  ])].filter(Boolean).slice(0, 10);

  const src = useMemo(() => {
    const q = new URLSearchParams({ embed: 'weyvo', ref: 'weyvo', theme });
    if (to) q.set('to', to.slice(0, 120));
    const depart = params.get('depart');
    const ret = params.get('return');
    if (depart && /^\d{4}-\d{2}-\d{2}$/.test(depart)) q.set('depart', depart);
    if (ret && /^\d{4}-\d{2}-\d{2}$/.test(ret)) q.set('return', ret);
    return `${ATLAS_URL}/?${q.toString()}`;
  }, [to, params, theme]);

  return (
    <div style={{ background: ATLAS_BG[theme], minHeight: '100dvh' }}>
      <div className="app" style={{ paddingBottom: 0, display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <header style={{ padding: 'max(14px, env(safe-area-inset-top)) 18px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, flex: '0 0 42px', background: 'var(--green)', color: 'var(--on-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.route size={22} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontFamily: "'Pacifico', cursive", fontWeight: 400, fontSize: 24, lineHeight: 1.2, color: theme === 'dark' ? '#E8D6B0' : '#22315C' }}>BubDub's Atlas</h1>
              <span className="display" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, fontSize: 13, color: 'var(--muted)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11 }}>by</span>
                <span style={{ color: 'var(--ink)', display: 'inline-flex', alignItems: 'baseline' }}>weyvo<Pin /></span>
              </span>
            </div>
            <button type="button" className="pill" aria-expanded={showInstall} onClick={() => setShowInstall((s) => !s)} style={{ minHeight: 34, fontSize: 12 }}>Get the app</button>
          </div>
          <p style={{ margin: '10px 2px 0', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Your next trip, planned in seconds.</p>
          {showInstall && <InstallSteps />}
          {ideas.length > 0 && (
            <div className="scroll-x" style={{ gap: 6, marginTop: 10, paddingBottom: 2 }} aria-label="Quick destinations">
              {ideas.map((name) => (
                <button key={name} type="button" className="pill" aria-pressed={to === name} style={{ minHeight: 34, fontSize: 12, flex: '0 0 auto' }}
                  onClick={() => setParams({ to: name }, { replace: true })}>
                  <Icon.pin size={13} /> {name}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* Atlas itself: the form, then the day-by-day plan, right here. */}
        <iframe key={src} src={src} title="BubDub's Atlas trip planner" allow="clipboard-write; web-share"
          style={{ flex: 1, width: '100%', border: 0, display: 'block', background: ATLAS_BG[theme], marginBottom: 'calc(84px + env(safe-area-inset-bottom))' }} />
      </div>
      <BottomNav />
    </div>
  );
}

/** How to add BubDub's Atlas to the home screen as its own app (it can't prompt from inside Weyvo). */
function InstallSteps() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="paper-card" style={{ marginTop: 10, padding: '12px 14px', borderLeft: '4px solid var(--gold)' }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>BubDub's Atlas as its own app</p>
      <p style={{ margin: '4px 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
        Saved plans open offline on the road.{' '}
        {ios ? <>Open it in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</> : <>Open it and choose <b>Install app</b> or <b>Add to Home screen</b> from the browser menu.</>}
      </p>
      <a className="btn btn-primary" href={atlasLink()} style={{ minHeight: 38 }}>Open BubDub's Atlas</a>
    </div>
  );
}
