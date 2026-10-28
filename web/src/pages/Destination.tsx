import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { people, placeBySlug, questions, shorts, trips } from '../mocks/data';

type Filter = 'all' | 'full' | 'short' | 'qa';
const FILTERS: [Filter, string][] = [['all', 'All'], ['full', 'Full trips'], ['short', 'Short stories'], ['qa', 'Questions']];
const MONTHS = 'JFMAMJJASOND'.split('');

export function Destination() {
  const { slug } = useParams();
  const [want, setWant] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const place = placeBySlug(slug);
  if (!place) return <Navigate to="/discover" replace />;

  const peak = Math.max(...place.monthly);
  const show = (f: Filter) => filter === 'all' || filter === f;
  const qa = questions.filter((q) => q.place === place.slug);

  return (
    <div className="app">
      <div className="cover" style={{ height: 330 }}>
        <Photo scene={place.scene} />
        <div className="cover-overlay" style={{ padding: '12px 10px 20px' }}>
          <Link to="/discover" className="icon-btn solid" aria-label="Back" style={{ color: 'var(--ink)' }}><Icon.back /></Link>
          <div style={{ padding: '0 10px' }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase' }}>Destination · {place.country}</p>
            <h1 className="display rise" style={{ margin: '6px 0 0', fontSize: 68 }}>{place.name}</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>{place.stories} stories · {place.shorts} short stories · {place.wantToGo.toLocaleString()} want to go</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => setWant(!want)} className="btn" aria-pressed={want}
          style={{ flex: 1, background: want ? 'var(--gold)' : 'var(--green)', color: want ? 'var(--on-gold)' : 'var(--on-green)', animation: want ? 'pop .35s ease-out' : undefined }}>
          {want ? 'On your map · Want to go' : 'Add to Want to go'}
        </button>
        <button type="button" className="btn btn-outline">Been there</button>
      </div>

      <div className="paper-card" style={{ margin: '18px 20px 0', padding: '14px 16px' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>When travellers went</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
          {place.monthly.map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ width: '100%', height: Math.round((v / peak) * 42), borderRadius: 3, background: v / peak > 0.8 ? 'var(--green)' : 'var(--line-strong)' }} />
              <span style={{ fontSize: 9, color: 'var(--muted)' }}>{MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Filter" className="scroll-x" style={{ padding: '18px 20px 6px' }}>
        {FILTERS.map(([f, l]) => (
          <button key={f} type="button" role="tab" className="tab" aria-selected={filter === f} onClick={() => setFilter(f)} style={{ fontSize: 13 }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: '8px 20px 0' }}>
        {show('full') && trips.map((t) => (
          <Link key={t.slug} to="/discover" className="rise" style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
            <div style={{ flex: '0 0 92px', height: 116, borderRadius: 4, overflow: 'hidden' }}><Photo scene={t.scene} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--green)' }}>Full trip</span>
              <p className="display" style={{ margin: '4px 0 0', fontSize: 21 }}>{t.title}</p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>{people[t.by].name} · {t.days}</p>
            </div>
          </Link>
        ))}
        {show('short') && shorts.slice(0, 3).map((s) => (
          <Link key={s.id} to="/shorts" className="rise" style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
            <div style={{ flex: '0 0 92px', height: 116, borderRadius: 4, overflow: 'hidden' }}><Photo scene={s.photos[0].scene} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--chip-gold-fg)' }}>Short story · {s.tag}</span>
              <p className="display" style={{ margin: '4px 0 0', fontSize: 21 }}>{s.title}</p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>{people[s.by].name} · {s.photos.length} photos</p>
            </div>
          </Link>
        ))}
        {show('qa') && qa.map((q) => (
          <div key={q.q} className="paper-card rise" style={{ margin: '12px 0' }}>
            <span className="eyebrow" style={{ fontSize: 10 }}>Ask the traveller</span>
            <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 600 }}>{q.q}</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}><strong style={{ color: 'var(--green)' }}>{q.by}:</strong> {q.a}</p>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
