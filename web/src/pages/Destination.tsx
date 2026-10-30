import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, sceneFor, TAG_LABEL, type PlaceDetail } from '../api';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { MapView } from '../components/MapView';
import { Photo } from '../components/Photo';
import { Empty, Loading } from '../components/States';
import { useApi } from '../useApi';
import { BackButton } from '../components/BackButton';
import { atlasLink, likeThisTrip } from '../atlas';
import { Icon } from '../components/Icons';

const MONTHS = 'JFMAMJJASOND'.split('');
type Filter = 'all' | 'FULL' | 'SHORT';

/** A real destination: stories at this place, when people went, and Been there / Want to go for your map. */
export function Destination() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { data: place, loading } = useApi(() => api.place(slug), [slug, user?.id]);
  const [filter, setFilter] = useState<Filter>('all');

  if (loading) return <div className="app" style={{ padding: 20 }}><Loading /></div>;
  if (!place) {
    return <div className="app" style={{ padding: 20 }}><Empty title="Place not found" body="It may not be on the map yet." cta={{ to: '/places', label: 'All destinations' }} /><BottomNav /></div>;
  }

  const cover = place.trips.find((t) => t.cover)?.cover?.url;
  const peak = Math.max(1, ...place.months);
  const shown = place.trips.filter((t) => filter === 'all' || t.kind === filter);

  return (
    <div className="app">
      <div className="cover" style={{ height: 300 }}>
        <Photo scene={sceneFor(place.name.length)} src={cover} />
        <div className="cover-overlay" style={{ padding: '12px 10px 20px' }}>
          <BackButton fallback="/places" solid style={{ color: 'var(--ink)' }} />
          <div style={{ padding: '0 10px' }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase' }}>Destination{place.country ? ` · ${place.country}` : ''}</p>
            <h1 className="display rise" style={{ margin: '6px 0 0', fontSize: 'clamp(44px, 10vw, 68px)' }}>{place.name}</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              {place.stories} {place.stories === 1 ? 'story' : 'stories'} · {place.shorts} short {place.shorts === 1 ? 'story' : 'stories'}
            </p>
          </div>
        </div>
      </div>

      <MarkButtons place={place} />
      <div style={{ padding: '10px 20px 0' }}>
        <a href={atlasLink({ to: place.name, back: `/places/${place.slug}`, ...likeThisTrip() })} className="btn btn-outline btn-block" style={{ minHeight: 44 }}>
          <Icon.route size={18} /> Plan a trip to {place.name}
        </a>
      </div>

      <div style={{ margin: '18px 20px 0' }}>
        <MapView pins={[{ placeSlug: place.slug, name: place.name, country: place.country, lat: place.lat, lng: place.lng, trips: [] }]} color="#1F4D3A" height={200} zoom={8} />
      </div>

      {place.months.some((m) => m > 0) && (
        <div className="paper-card" style={{ margin: '18px 20px 0', padding: '14px 16px' }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>When travellers went</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }} role="img"
            aria-label={`Trips by month: ${place.months.map((m, i) => `${MONTHS[i]} ${m}`).join(', ')}`}>
            {place.months.map((v, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ width: '100%', height: Math.max(3, Math.round((v / peak) * 42)), borderRadius: 3, background: v === peak ? 'var(--green)' : 'var(--line-strong)' }} />
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Filter" className="scroll-x" style={{ padding: '18px 20px 6px' }}>
        {([['all', 'All'], ['FULL', 'Full trips'], ['SHORT', 'Short stories']] as [Filter, string][]).map(([f, l]) => (
          <button key={f} type="button" role="tab" className="tab" aria-selected={filter === f} onClick={() => setFilter(f)} style={{ fontSize: 13 }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: '8px 20px 0' }}>
        {shown.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>No public stories here yet.</p>
        ) : shown.map((t) => (
          <Link key={t.id} to={`/trips/${t.slug}`} className="rise" style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
            <div style={{ flex: '0 0 92px', height: 116, borderRadius: 4, overflow: 'hidden' }}><Photo scene={sceneFor(t.id)} src={t.cover?.thumbUrl} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: t.kind === 'FULL' ? 'var(--green)' : 'var(--chip-gold-fg)' }}>
                {t.kind === 'FULL' ? 'Full trip' : `Short story${t.shortTag ? ` · ${TAG_LABEL[t.shortTag]}` : ''}`}
              </span>
              <p className="display" style={{ margin: '4px 0 0', fontSize: 21 }}>{t.title}</p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>{t.author.username}</p>
            </div>
          </Link>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}

/** Been there (public, on your map) and Want to go (private list). Tap again to undo. */
function MarkButtons({ place }: { place: PlaceDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [r, setR] = useState(place.reactions);
  const [error, setError] = useState('');

  async function toggle(type: 'been' | 'want') {
    if (!user) return navigate(`/signin?mode=join&next=${encodeURIComponent(location.pathname)}`);
    const on = type === 'been' ? !r.beenByMe : !r.wantByMe;
    const before = r;
    setR(type === 'been' ? { ...r, beenByMe: on, been: r.been + (on ? 1 : -1) } : { ...r, wantByMe: on, want: r.want + (on ? 1 : -1) });
    setError('');
    try {
      setR(on ? await api.markPlace(place.slug, type) : await api.unmarkPlace(place.slug, type));
    } catch (err) {
      setR(before);
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <div style={{ padding: '16px 20px 0' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn" aria-pressed={r.wantByMe} onClick={() => toggle('want')}
          style={{ flex: 1, background: r.wantByMe ? 'var(--gold)' : 'var(--green)', color: r.wantByMe ? 'var(--on-gold)' : 'var(--on-green)' }}>
          {r.wantByMe ? '✓ On your Want to go list' : 'Add to Want to go'}
        </button>
        <button type="button" className={r.beenByMe ? 'btn btn-primary' : 'btn btn-outline'} aria-pressed={r.beenByMe} onClick={() => toggle('been')}>
          {r.beenByMe ? '✓ Been there' : 'Been there'}
        </button>
      </div>
      <p style={{ margin: '8px 2px 0', fontSize: 12, color: 'var(--muted)' }}>
        {r.been} {r.been === 1 ? 'traveller has' : 'travellers have'} been · {r.want} want to go. Been there shows on your map; Want to go stays private.
      </p>
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}
