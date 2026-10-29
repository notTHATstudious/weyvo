import { Link } from 'react-router-dom';
import { api } from '../api';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
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

export function PlaceList({ items, loading, limit }: { items: Awaited<ReturnType<typeof api.places>> | null; loading: boolean; limit?: number }) {
  if (loading) return <Loading />;
  if (!items?.length) return <Empty title="No destinations yet" body="Places appear here once stories are published and found on the map." />;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.slice(0, limit).map((p) => (
        <li key={p.slug}>
          <Link to={`/places/${p.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
            <span aria-hidden="true" style={{ flex: '0 0 44px', height: 44, borderRadius: 12, background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.pin /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="display" style={{ display: 'block', fontSize: 22 }}>{p.name}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>
                {p.country ? `${p.country} · ` : ''}{p.stories} {p.stories === 1 ? 'story' : 'stories'} · {p.shorts} short
              </span>
            </span>
            <span style={{ color: 'var(--muted)' }}><Icon.chevronRight /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
