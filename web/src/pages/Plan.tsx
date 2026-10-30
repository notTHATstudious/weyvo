import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ATLAS_URL, atlasLink } from '../atlas';
import { BottomNav } from '../components/BottomNav';
import { Pin } from '../components/Wordmark';

/** BubDub's Atlas page colours, so the planner sits on the same background as Weyvo around it. */
const ATLAS_BG = { light: '#F4EEE9', dark: '#14110F' } as const;

/**
 * The Plan tab: BubDub's Atlas running inside Weyvo, like a mini-app. The planner and its results show
 * right here, in Atlas's own look; Atlas is also its own app, which this page offers to install.
 * ?to=, ?depart= and ?return= (from a story or destination) fill the trip in.
 */
export function Plan() {
  const [params] = useSearchParams();
  const theme: 'light' | 'dark' = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const [showInstall, setShowInstall] = useState(false);
  const prompt = useInstallPrompt();

  const to = params.get('to') ?? '';

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
            <img src="/atlas-icon.png" alt="" width={46} height={46} style={{ flex: '0 0 46px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.18)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontFamily: "'Pacifico', cursive", fontWeight: 400, fontSize: 24, lineHeight: 1.2, color: theme === 'dark' ? '#E8D6B0' : '#22315C' }}>BubDub's Atlas</h1>
              <span className="display" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, fontSize: 13, color: 'var(--muted)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 11 }}>by</span>
                <span style={{ color: 'var(--ink)', display: 'inline-flex', alignItems: 'baseline' }}>weyvo<Pin /></span>
              </span>
            </div>
            <button type="button" aria-expanded={showInstall} aria-label="Install BubDub's Atlas" onClick={() => setShowInstall((s) => !s)}
              style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32, padding: '0 4px', border: 0, background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 600 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              Install
            </button>
          </div>
          {/* The tagline as a masthead line: centred between two hairlines. */}
          <div aria-hidden="false" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 4px 4px' }}>
            <span style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${theme === 'dark' ? '#D9B26A' : '#A9711C'})`, opacity: .55 }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: theme === 'dark' ? '#D9B26A' : '#A9711C' }}>Plan less · Wander more</span>
            <span style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${theme === 'dark' ? '#D9B26A' : '#A9711C'})`, opacity: .55 }} />
          </div>
          {showInstall && <InstallSteps onClose={() => setShowInstall(false)} />}
        </header>

        {/* Atlas itself: the form, then the day-by-day plan, right here. */}
        <iframe key={src} src={src} title="BubDub's Atlas trip planner" allow="clipboard-write; web-share"
          style={{ flex: 1, width: '100%', border: 0, display: 'block', background: ATLAS_BG[theme], marginBottom: 'calc(84px + env(safe-area-inset-bottom))' }} />
      </div>
      {prompt.show && (
        <div role="status" style={{ position: 'fixed', left: 0, right: 0, margin: '0 auto', bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 25,
          width: 'min(92vw, 440px)', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px 9px 14px', borderRadius: 16,
          background: '#1C1B18', color: '#FBF8F2', boxShadow: '0 8px 24px rgba(0,0,0,.25)', animation: 'riseIn .35s ease-out both' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flex: '0 0 8px' }} />
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>Keep this plan offline: add BubDub's Atlas to your Home Screen.</span>
          <button type="button" onClick={() => { prompt.dismiss(); setShowInstall(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            style={{ border: 0, borderRadius: 10, background: '#FBF8F2', color: '#1C1B18', fontSize: 12, fontWeight: 700, padding: '7px 12px', flex: '0 0 auto' }}>How</button>
          <button type="button" aria-label="Dismiss" onClick={prompt.dismiss}
            style={{ border: 0, background: 'transparent', color: '#CFC8BA', fontSize: 18, lineHeight: 1, width: 30, height: 30, flex: '0 0 auto' }}>×</button>
        </div>
      )}
      <BottomNav />
    </div>
  );
}

const PROMPTED = 'weyvo-atlas-install-prompted';

/**
 * After the first plan is ready (Atlas says so; no trip details are sent), offer installing Atlas once.
 * Not again for 30 days, whichever button is tapped.
 */
function useInstallPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const atlasOrigin = new URL(ATLAS_URL).origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== atlasOrigin || (e.data as { type?: string } | null)?.type !== 'atlas:planned') return;
      try {
        if (Date.now() - Number(localStorage.getItem(PROMPTED) ?? 0) < 30 * 86_400_000) return;
        localStorage.setItem(PROMPTED, String(Date.now()));
      } catch {
        return;
      }
      setShow(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return { show, dismiss: () => setShow(false) };
}

/** How to add BubDub's Atlas to the home screen as its own app (it can't prompt from inside Weyvo). */
function InstallSteps({ onClose }: { onClose: () => void }) {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="paper-card rise" style={{ position: 'relative', marginTop: 10, padding: '12px 40px 12px 14px', borderLeft: '4px solid var(--gold)' }}>
      <button type="button" aria-label="Close" onClick={onClose}
        style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, border: 0, background: 'transparent', color: 'var(--muted)', fontSize: 18 }}>×</button>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add BubDub's Atlas to your Home Screen</p>
      <p style={{ margin: '4px 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
        Saved plans open offline on the road.{' '}
        {ios ? <>Open it in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</> : <>Open it and choose <b>Install app</b> or <b>Add to Home screen</b> from the browser menu.</>}
      </p>
      <a className="btn btn-primary" href={atlasLink()} style={{ minHeight: 38 }}>Open BubDub's Atlas</a>
    </div>
  );
}
