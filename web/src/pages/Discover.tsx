import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Reactions } from '../components/Reactions';
import { people, places, shorts, trips } from '../mocks/data';

const TABS = [
  { id: 'following', label: 'Following' },
  { id: 'shorts', label: 'Short Stories' },
  { id: 'places', label: 'Destinations' },
  { id: 'issue', label: "This week's Issue" },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function Discover() {
  const [tab, setTab] = useState<Tab>('following');

  return (
    <div className="app">
      <div className="topbar">
        <span className="display" style={{ fontSize: 26 }}>weyvo<span style={{ color: 'var(--gold)' }}>.</span></span>
        <div style={{ display: 'flex' }}>
          <Link to="/places/kyoto" className="icon-btn" aria-label="Search places"><Icon.search /></Link>
          <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon.settings /></Link>
        </div>
      </div>

      <div role="tablist" aria-label="Discover sections" className="scroll-x" style={{ padding: '6px 20px 14px' }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {tab === 'following' && (
          <>
            <Link to={`/trips/${trips[2].slug}`} className="paper-card rise" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, textDecoration: 'none', color: 'var(--ink)' }}>
              <div style={{ flex: '0 0 64px', height: 64, borderRadius: 12, overflow: 'hidden' }}><Photo scene="forest" /></div>
              <div><p className="eyebrow">On this day · 2024</p><p className="display" style={{ margin: '4px 0 0', fontSize: 20 }}>You were in Coorg. Relive it?</p></div>
            </Link>
            {trips.slice(0, 2).map((t) => {
              const p = people[t.by];
              return (
                <article key={t.slug} className="rise" style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: p.color, color: '#FBF8F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{p.initial}</span>
                    <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name}</p><p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--muted)' }}>Full trip · {t.when}</p></div>
                    <Link to={`/u/${p.handle}`} style={{ fontSize: 13, fontWeight: 500, padding: '12px 0 12px 8px' }}>View</Link>
                  </div>
                  <Link to={`/trips/${t.slug}`} className="cover" style={{ height: 400, borderRadius: 'var(--radius-sm)' }}>
                    <Photo scene={t.scene} />
                    <div className="cover-overlay">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Full trip</span><span>{t.issue}</span></div>
                      <div><p style={{ margin: 0, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase' }}>{t.place}</p><p className="display" style={{ margin: '6px 0 0', fontSize: 34 }}>{t.title}</p></div>
                    </div>
                  </Link>
                  <div style={{ marginTop: 12 }}><Reactions been={t.been} want={t.want} /></div>
                </article>
              );
            })}
          </>
        )}

        {tab === 'shorts' && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--muted)' }}>Weekends, one-night stays and long drives from people you follow.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {shorts.map((s) => (
                <Link key={s.id} to={`/shorts?start=${s.id}`} className="cover rise" style={{ height: 250, borderRadius: 16 }}>
                  <Photo scene={s.photos[0].scene} />
                  <div className="cover-overlay" style={{ padding: 10 }}>
                    <span className="tag" style={{ alignSelf: 'flex-start', fontSize: 10 }}>{s.tag}</span>
                    <p className="display" style={{ margin: 0, fontSize: 19 }}>{s.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {tab === 'places' && places.map((p) => (
          <Link key={p.slug} to={`/places/${p.slug}`} className="rise" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
            <div style={{ flex: '0 0 72px', height: 72, borderRadius: 12, overflow: 'hidden' }}><Photo scene={p.scene} /></div>
            <div style={{ flex: 1 }}><p className="display" style={{ margin: 0, fontSize: 24 }}>{p.name}</p><p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>{p.stories} stories · {p.shorts} short stories</p></div>
            <span style={{ color: 'var(--muted)' }}><Icon.chevronRight /></span>
          </Link>
        ))}

        {tab === 'issue' && (
          <div className="rise" style={{ background: '#1C1B18', color: '#FBF8F2', borderRadius: 'var(--radius-sm)', padding: 12 }}>
            <div className="cover" style={{ height: 420 }}>
              <Photo scene="sea" />
              <div className="cover-overlay">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo · Weekly</span><span>No. 43</span></div>
                <p className="display" style={{ margin: 0, fontSize: 52 }}>Monsoon getaways</p>
              </div>
            </div>
            <p style={{ margin: '14px 4px 4px', fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>Five stories, three short drives and one traveller to follow this week. Picked by the editors every Sunday.</p>
            <Link to={`/trips/${trips[3].slug}`} className="btn btn-block" style={{ marginTop: 10, background: '#FBF8F2', color: '#1C1B18' }}>Open this week's Issue</Link>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
