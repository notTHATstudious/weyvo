import { Link } from 'react-router-dom';
import { api, type PlaceSummary } from '../api';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { MiniMap } from '../components/MiniMap';
import { Empty, Loading } from '../components/States';
import { useApi } from '../useApi';

/** Destinations with the most public stories, from real data. */
export function Places() {
  const { data, loading } = useApi(() => api.places(), []);
  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to="/discover" className="icon-btn" aria-label="Back"><Icon.back /></Link>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Destinations</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display" style={{ margin: '8px 0 16px', fontSize: 38 }}>Where people went</h1>
        <PlaceList items={data} loading={loading} />
      </div>
      <BottomNav />
    </div>
  );
}

export function PlaceList({ items, loading, limit }: { items: PlaceSummary[] | null; loading: boolean; limit?: number }) {
  if (loading) return <Loading />;
  if (!items?.length) return <Empty title="No destinations yet" body="Places appear here once stories are published and found on the map." />;
  return (
    <>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.slice(0, limit).map((p) => (
          <li key={p.slug}>
            <Link to={`/places/${p.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', textDecoration: 'none', color: 'var(--ink)' }}>
              <MiniMap lat={p.lat} lng={p.lng} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="display" style={{ display: 'block', fontSize: 22 }}>{p.name}</span>
                {p.country && <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--ink-soft)' }}>{p.country}</span>}
                <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{counts(p)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
        Maps © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>OpenStreetMap</a> contributors
      </p>
    </>
  );
}

/** "2 stories · 1 short story", leaving out whatever is zero. */
function counts(p: PlaceSummary) {
  return [
    p.stories ? `${p.stories} ${p.stories === 1 ? 'story' : 'stories'}` : null,
    p.shorts ? `${p.shorts} short ${p.shorts === 1 ? 'story' : 'stories'}` : null,
  ].filter(Boolean).join(' · ');
}
