import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, sceneFor, type TripCard } from '../api';
import { Avatar } from '../components/Avatar';
import { Footer } from '../components/Footer';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Reactions } from '../components/Reactions';
import { Empty, ErrorNote, Loading } from '../components/States';
import { PlaceList } from './Places';
import { useApi } from '../useApi';

const ALL_TABS = [
  { id: 'following', label: 'Following' },
  { id: 'latest', label: 'Latest' },
  { id: 'places', label: 'Destinations' },
  { id: 'issue', label: 'This week' },
] as const;
type Tab = (typeof ALL_TABS)[number]['id'];

export function Discover() {
  const { signedIn, user } = useAuth();
  // Following needs an account; signed-out readers start on Latest.
  const TABS = signedIn ? ALL_TABS : ALL_TABS.filter((t) => t.id !== 'following');
  const [picked, setPicked] = useState<Tab | null>(null);
  // New accounts follow no one yet, so they start on Latest; once they follow people, Following comes first.
  const me = useApi(() => (user ? api.user(user.username) : Promise.resolve(null)), [user?.username]);
  const tab: Tab = picked ?? (signedIn && (me.data?.following ?? 0) > 0 ? 'following' : 'latest');
  const setTab = setPicked;

  return (
    <div className="app with-rail">
      <div className="rail-grid">
      <div>
      <div className="topbar">
        <span className="display brand-mobile" style={{ fontSize: 26 }}>weyvo<span style={{ color: 'var(--gold)' }}>.</span></span>
        <div style={{ display: 'flex' }}>
          <Link to="/search" className="icon-btn" aria-label="Search"><Icon.search /></Link>
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

        {tab === 'places' && <DiscoverPlaces />}
        {tab === 'issue' && <ThisWeek />}
      </div>
      </div>
      <Rail />
      </div>
      <BottomNav />
    </div>
  );
}

/** The week's most loved stories, ranked by reactions and comments from the last 7 days. */
function ThisWeek() {
  const { data, error, loading, retry } = useApi(() => api.thisWeek(), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote message={error.message} onRetry={retry} />;
  const now = new Date();
  const from = new Date(now.getTime() - 6 * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <div className="rise">
      <div style={{ background: '#1C1B18', color: '#FBF8F2', borderRadius: 'var(--radius-sm)', padding: '18px 18px 16px' }}>
        <p style={{ margin: 0, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--gold)' }}>Weyvo · This week · {fmt(from)} – {fmt(now)}</p>
        <p className="display" style={{ margin: '8px 0 0', fontSize: 34 }}>Most loved this week</p>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: '#CFC8BA' }}>Ranked by Been there, Want to go, saves and comments from the last 7 days.</p>
      </div>
      {!data?.length ? (
        <p style={{ margin: '16px 2px 0', fontSize: 14, color: 'var(--ink-soft)' }}>Quiet week so far. Stories people love show up here.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
          {data.map((t, i) => (
            <li key={t.id}>
              <Link to={`/trips/${t.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' }}>
                <span className="display" style={{ flex: '0 0 30px', fontSize: 30, color: i < 3 ? 'var(--gold)' : 'var(--muted)', textAlign: 'center' }}>{i + 1}</span>
                <span style={{ flex: '0 0 76px', height: 96, borderRadius: 8, overflow: 'hidden' }}><Photo scene={sceneFor(t.id)} src={t.cover?.thumbUrl} /></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t.kind === 'FULL' ? 'Full trip' : 'Short story'} · {t.place}</span>
                  <span className="display" style={{ display: 'block', marginTop: 4, fontSize: 20 }}>{t.title}</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{t.author.username} · {t.reactions.been} been · {t.reactions.want} want to go</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DiscoverPlaces() {
  const { data, loading } = useApi(() => api.places(), []);
  return <PlaceList items={data} loading={loading} />;
}

function RailPlaces() {
  const { data, loading } = useApi(() => api.places(), []);
  return <PlaceList items={data} loading={loading} limit={4} />;
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
        <RailPlaces />
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
  const { data, error, loading, retry } = useApi(() => api.followingFeed(), []);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error.message} onRetry={retry} />;
  if (!data?.length) {
    return (
      <>
        <div className="paper-card" style={{ textAlign: 'center', padding: '26px 20px' }}>
          <p className="display" style={{ margin: 0, fontSize: 26 }}>Your Following feed is quiet</p>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>Follow travellers whose stories you like, and their new trips show up here.</p>
          <button type="button" className="btn btn-outline" onClick={onBrowse} style={{ marginTop: 16 }}>Browse latest stories</button>
        </div>
        <SuggestedTravellers />
      </>
    );
  }
  return <>{data.map((t) => <TripFeedCard key={t.id} trip={t} />)}</>;
}

/** A few active travellers to follow, each with a one-tap Follow. */
function SuggestedTravellers() {
  const { data } = useApi(() => api.suggestedTravellers(), []);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  if (!data?.length) return null;
  return (
    <section style={{ marginTop: 18 }}>
      <h2 className="eyebrow" style={{ margin: '0 0 6px', fontWeight: 600 }}>Travellers to follow</h2>
      {data.map((p) => {
        const on = !!followed[p.username];
        return (
          <div key={p.username} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <Link to={`/u/${p.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, color: 'var(--ink)', textDecoration: 'none' }}>
              <Avatar name={p.displayName} url={p.avatarUrl} size={44} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{p.username}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{p.stories} {p.stories === 1 ? 'story' : 'stories'}</span>
              </span>
            </Link>
            <button type="button" className={on ? 'btn btn-outline' : 'btn btn-primary'} aria-pressed={on} style={{ minHeight: 36, padding: '0 16px', fontSize: 13 }}
              onClick={async () => {
                setFollowed((f) => ({ ...f, [p.username]: !on }));
                try { await api.follow(p.username, !on); } catch { setFollowed((f) => ({ ...f, [p.username]: on })); }
              }}>
              {on ? 'Following' : 'Follow'}
            </button>
          </div>
        );
      })}
    </section>
  );
}

function LatestTrips() {
  const { data, error, loading, retry } = useApi(() => api.feed('FULL'), []);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error.message} onRetry={retry} />;
  if (!data?.length) return <Empty title="No stories yet" body="Be the first to publish a trip on Weyvo." cta={{ to: '/create', label: 'Create your first issue' }} />;
  return <>{data.map((t) => <TripFeedCard key={t.id} trip={t} />)}</>;
}

function TripFeedCard({ trip }: { trip: TripCard }) {
  return (
    <article className="rise" style={{ marginBottom: 28 }}>
      <Link to={`/u/${trip.author.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '4px 0', textDecoration: 'none', color: 'var(--ink)' }}>
        <Avatar name={trip.author.displayName} url={trip.author.avatarUrl} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{trip.author.username}</span>
          <span style={{ display: 'block', marginTop: 1, fontSize: 12, color: 'var(--muted)' }}>{timeAgo(trip.publishedAt)}</span>
        </span>
      </Link>
      <Link to={`/trips/${trip.slug}`} className="cover" style={{ height: 400, borderRadius: 'var(--radius-sm)' }}>
        <Photo scene={sceneFor(trip.id)} src={trip.cover?.url} />
        <div className="cover-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Full trip</span><span>Weyvo</span></div>
          <div><p style={{ margin: 0, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase' }}>{trip.place}</p><p className="display" style={{ margin: '6px 0 0', fontSize: 34 }}>{trip.title}</p></div>
        </div>
      </Link>
      <div style={{ marginTop: 12 }}><Reactions tripId={trip.id} initial={trip.reactions} author={trip.author.username} /></div>
    </article>
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
