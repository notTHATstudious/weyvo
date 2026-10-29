import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, sceneFor, TAG_LABEL, type TripCard } from '../api';
import { Avatar } from '../components/Avatar';
import { Footer } from '../components/Footer';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Reactions } from '../components/Reactions';
import { Empty, ErrorNote, Loading } from '../components/States';
import { places } from '../mocks/data';
import { useApi } from '../useApi';

const ALL_TABS = [
  { id: 'following', label: 'Following' },
  { id: 'latest', label: 'Latest' },
  { id: 'shorts', label: 'Short Stories' },
  { id: 'places', label: 'Destinations' },
  { id: 'issue', label: "This week's Issue" },
] as const;
type Tab = (typeof ALL_TABS)[number]['id'];

export function Discover() {
  const { signedIn } = useAuth();
  // Following needs an account; signed-out readers start on Latest.
  const TABS = signedIn ? ALL_TABS : ALL_TABS.filter((t) => t.id !== 'following');
  const [picked, setPicked] = useState<Tab | null>(null);
  const tab: Tab = picked ?? (signedIn ? 'following' : 'latest');
  const setTab = setPicked;

  return (
    <div className="app with-rail">
      <div className="rail-grid">
      <div>
      <div className="topbar">
        <span className="display brand-mobile" style={{ fontSize: 26 }}>weyvo<span style={{ color: 'var(--gold)' }}>.</span></span>
        <div style={{ display: 'flex' }}>
          <Link to="/places/kyoto" className="icon-btn" aria-label="Search places"><Icon.search /></Link>
          {signedIn && <NotificationBell />}
          <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon.settings /></Link>
        </div>
      </div>

      <div role="tablist" aria-label="Discover sections" className="scroll-x" style={{ padding: '6px 20px 14px' }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {tab === 'following' && <FollowingTrips onBrowse={() => setTab('latest')} />}
        {tab === 'latest' && <LatestTrips />}
        {tab === 'shorts' && <LatestShorts />}

        {/* Destinations and the weekly Issue use sample content until the places and editorial APIs exist. */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo · Weekly</span><span>No. 1</span></div>
                <p className="display" style={{ margin: 0, fontSize: 52 }}>Monsoon getaways</p>
              </div>
            </div>
            <p style={{ margin: '14px 4px 4px', fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>
              Stories picked by the editors every Sunday. The first real Issue goes out once there are stories to feature.
            </p>
          </div>
        )}
      </div>
      </div>
      <Rail />
      </div>
      <BottomNav />
    </div>
  );
}

/** Desktop-only right column (hidden on phones by CSS). */
function Rail() {
  const { signedIn } = useAuth();
  return (
    <aside className="rail" aria-label="More on Weyvo">
      <div style={{ background: 'var(--green)', color: 'var(--on-green)', borderRadius: 20, padding: '20px 18px' }}>
        <p className="eyebrow" style={{ color: 'var(--gold)' }}>Weyvo Premium</p>
        <p className="display" style={{ margin: '8px 0 0', fontSize: 24 }}>More room for every journey.</p>
        <p style={{ margin: '8px 0 14px', fontSize: 13, opacity: 0.9 }}>Bigger stories, unlimited photos, a profile badge.</p>
        <Link to={signedIn ? '/premium' : '/signin?mode=join&next=/premium'} className="btn" style={{ background: 'var(--card)', color: 'var(--ink)', minHeight: 40 }}>See Premium</Link>
      </div>
      <div className="paper-card">
        <p className="eyebrow" style={{ marginBottom: 8 }}>Popular destinations</p>
        {places.slice(0, 4).map((p) => (
          <Link key={p.slug} to={`/places/${p.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', textDecoration: 'none', color: 'var(--ink)' }}>
            <span style={{ flex: '0 0 40px', height: 40, borderRadius: 10, overflow: 'hidden' }}><Photo scene={p.scene} /></span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}<span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>{p.stories} stories</span></span>
          </Link>
        ))}
      </div>
      <Footer compact />
    </aside>
  );
}

/** Bell with an unread dot. Checked when Discover opens; no background polling. */
function NotificationBell() {
  const { data } = useApi(() => api.unreadCount(), []);
  const unread = data?.count ?? 0;
  return (
    <Link to="/notifications" className="icon-btn" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} style={{ position: 'relative' }}>
      <Icon.bell />
      {unread > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)' }} />}
    </Link>
  );
}

function FollowingTrips({ onBrowse }: { onBrowse: () => void }) {
  const { data, error, loading } = useApi(() => api.followingFeed(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error.message} />;
  if (!data?.length) {
    return (
      <div className="paper-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <p className="display" style={{ margin: 0, fontSize: 26 }}>Your Following feed is quiet</p>
        <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>Follow travellers whose stories you like, and their new trips show up here.</p>
        <button type="button" className="btn btn-primary" onClick={onBrowse} style={{ marginTop: 18 }}>Find travellers</button>
      </div>
    );
  }
  return <>{data.map((t) => <TripFeedCard key={t.id} trip={t} />)}</>;
}

function LatestTrips() {
  const { data, error, loading } = useApi(() => api.feed('FULL'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error.message} />;
  if (!data?.length) return <Empty title="No stories yet" body="Be the first to publish a trip on Weyvo." cta={{ to: '/create', label: 'Create your first issue' }} />;
  return <>{data.map((t) => <TripFeedCard key={t.id} trip={t} />)}</>;
}

function TripFeedCard({ trip }: { trip: TripCard }) {
  return (
    <article className="rise" style={{ marginBottom: 28 }}>
      <Link to={`/u/${trip.author.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '4px 0', textDecoration: 'none', color: 'var(--ink)' }}>
        <Avatar name={trip.author.displayName} url={trip.author.avatarUrl} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{trip.author.displayName}</span>
          <span style={{ display: 'block', marginTop: 1, fontSize: 12, color: 'var(--muted)' }}>@{trip.author.username} · {timeAgo(trip.publishedAt)}</span>
        </span>
      </Link>
      <Link to={`/trips/${trip.slug}`} className="cover" style={{ height: 400, borderRadius: 'var(--radius-sm)' }}>
        <Photo scene={sceneFor(trip.id)} src={trip.cover?.url} />
        <div className="cover-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Full trip</span><span>Weyvo</span></div>
          <div><p style={{ margin: 0, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase' }}>{trip.place}</p><p className="display" style={{ margin: '6px 0 0', fontSize: 34 }}>{trip.title}</p></div>
        </div>
      </Link>
      <div style={{ marginTop: 12 }}><Reactions tripId={trip.id} initial={trip.reactions} /></div>
    </article>
  );
}

function LatestShorts() {
  const { data, error, loading } = useApi(() => api.feed('SHORT'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error.message} />;
  if (!data?.length) return <Empty title="No short stories yet" body="A weekend, a one-night stay, a long drive. Post one in a minute." cta={{ to: '/create?type=short', label: 'Post a short story' }} />;
  return (
    <>
      <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--muted)' }}>Weekends, one-night stays and long drives.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {data.map((s) => (
          <Link key={s.id} to={`/shorts?start=${s.slug}`} className="cover rise" style={{ height: 250, borderRadius: 16 }}>
            <Photo scene={sceneFor(s.id)} src={s.cover?.thumbUrl} />
            <div className="cover-overlay" style={{ padding: 10 }}>
              {s.shortTag && <span className="tag" style={{ alignSelf: 'flex-start', fontSize: 10 }}>{TAG_LABEL[s.shortTag]}</span>}
              <p className="display" style={{ margin: 0, fontSize: 19 }}>{s.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Draft';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days} d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
