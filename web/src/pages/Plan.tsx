import { useState } from 'react';
import { api } from '../api';
import { atlasLink, daysFromNow, type AtlasStyle } from '../atlas';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { PlaceField } from '../components/PlaceField';
import { useApi } from '../useApi';

const STYLES: [AtlasStyle, string][] = [['budget', 'Budget'], ['balanced', 'Balanced'], ['premium', 'Premium']];

/**
 * The Plan tab: BubDub's Atlas, Weyvo's trip-planning companion. A quick form here, the full planner in
 * Atlas (its own app), opened with the trip filled in.
 */
export function Plan() {
  const { user } = useAuth();
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [depart, setDepart] = useState(daysFromNow(14));
  const [ret, setRet] = useState(daysFromNow(17));
  const [style, setStyle] = useState<AtlasStyle>('balanced');
  const want = useApi(() => (user ? api.myList('want') : Promise.resolve([])), [user?.id]);
  const popular = useApi(() => api.places(), []);

  const ideas = [...new Set([
    ...(want.data ?? []).map((t) => t.place.split(',')[0].trim()),
    ...(popular.data ?? []).map((p) => p.name),
  ])].filter(Boolean).slice(0, 8);

  const go = (dest = to) => {
    window.location.href = atlasLink({ to: dest.trim(), from: from.trim(), depart, ret: ret >= depart ? ret : depart, style });
  };

  return (
    <div className="app">
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--green)', color: 'var(--on-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.route size={24} /></span>
          <div>
            <h1 className="display" style={{ margin: 0, fontSize: 32 }}>Plan a trip</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>with <strong style={{ color: 'var(--ink)' }}>BubDub's Atlas</strong> by Weyvo</p>
          </div>
        </div>
        <p style={{ margin: '14px 0 18px', fontSize: 15, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
          A day-by-day plan with places, travel options and a rough budget, in a few seconds. Then come back and tell the story.
        </p>

        <form className="paper-card" style={{ padding: '16px 16px 18px' }} onSubmit={(e) => { e.preventDefault(); go(); }}>
          <PlaceField id="plan-to" label="Where to" value={to} onChange={setTo} placeholder="Spiti, Hampi, Goa…" />
          <PlaceField id="plan-from" label="From (optional)" value={from} onChange={setFrom} placeholder="Mumbai" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span className="field-label">Leave</span>
              <input className="input" type="date" value={depart} min={daysFromNow(0)} onChange={(e) => setDepart(e.target.value)} />
            </label>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span className="field-label">Head home</span>
              <input className="input" type="date" value={ret} min={depart} onChange={(e) => setRet(e.target.value)} />
            </label>
          </div>
          <p className="field-label">Travel style</p>
          <div role="radiogroup" aria-label="Travel style" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {STYLES.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={style === v} className="pill" aria-pressed={style === v} onClick={() => setStyle(v)} style={{ minHeight: 40 }}>{l}</button>
            ))}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={!to.trim()}>Plan with BubDub's Atlas</button>
          <p style={{ margin: '10px 2px 0', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Opens BubDub's Atlas with your trip filled in. "Back to Weyvo" brings you here.</p>
        </form>

        {ideas.length > 0 && (
          <section style={{ marginTop: 22 }}>
            <h2 className="eyebrow" style={{ margin: '0 0 10px', fontWeight: 600 }}>{want.data?.length ? 'From your Want to go, and popular now' : 'Popular on Weyvo'}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ideas.map((name) => (
                <button key={name} type="button" className="pill" onClick={() => go(name)} style={{ minHeight: 40 }}>
                  <Icon.pin size={15} /> Plan {name}
                </button>
              ))}
            </div>
          </section>
        )}

        <AtlasInstall />
      </div>
      <BottomNav />
    </div>
  );
}

const HIDE_KEY = 'weyvo-atlas-install-hidden';

/** "Get BubDub's Atlas on your home screen": hidden for 14 days when dismissed. */
function AtlasInstall() {
  const [hidden, setHidden] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(HIDE_KEY) ?? 0) < 14 * 86_400_000;
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <section className="paper-card" style={{ marginTop: 22, padding: '14px 16px', borderLeft: '4px solid var(--gold)' }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Get BubDub's Atlas as its own app</p>
      <p style={{ margin: '6px 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
        Saved plans open offline on the road.{' '}
        {ios ? <>Open Atlas in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</> : <>Open Atlas and choose <b>Install app</b> or <b>Add to Home screen</b> from the browser menu.</>}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <a className="btn btn-outline" href={atlasLink()} style={{ minHeight: 38 }}>Open Atlas</a>
        <button type="button" className="btn btn-outline" style={{ minHeight: 38, borderColor: 'var(--line-strong)' }}
          onClick={() => { setHidden(true); try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch { /* fine */ } }}>Not now</button>
      </div>
    </section>
  );
}
