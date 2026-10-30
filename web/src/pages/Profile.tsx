import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, sceneFor, type FollowStats, type TripCard } from '../api';
import { Avatar } from '../components/Avatar';
import { shareLink } from '../share';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Empty, Loading } from '../components/States';
import { TravelMap } from '../components/TravelMap';
import { useApi } from '../useApi';

type Shelf = 'issues' | 'shorts' | 'want' | 'save';

export function Profile() {
  const { handle = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [follow, setFollow] = useState<FollowStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [shelf, setShelf] = useState<Shelf>('issues');
  const [menu, setMenu] = useState(false);
  const isMe = user?.username.toLowerCase() === handle.toLowerCase();

  const person = useApi(() => api.user(handle), [handle, user?.id, version]);
  // Your own profile includes drafts and private trips; anyone else's shows public ones only.
  const trips = useApi(() => (isMe ? api.myTrips() : api.userTrips(handle)), [handle, isMe, version]);

  if (person.loading) return <div className="app" style={{ padding: 20 }}><Loading /></div>;
  if (!person.data) {
    return <div className="app" style={{ padding: 20 }}><Empty title="No one here" body="This traveller doesn't exist or has left Weyvo." cta={{ to: '/discover', label: 'Back to Discover' }} /><BottomNav /></div>;
  }

  const p = person.data;
  if (p.blockedByMe) {
    return (
      <div className="app">
        <div className="topbar"><span style={{ fontSize: 15, fontWeight: 700 }}>@{p.username}</span><span /></div>
        <div style={{ padding: '4px 20px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
          <Avatar name={p.displayName} url={p.avatarUrl} size={80} ring="var(--card)" />
          <h1 className="display" style={{ margin: 0, fontSize: 30 }}>{p.displayName}</h1>
        </div>
        <div className="paper-card" style={{ margin: '20px 20px 0', padding: '16px 18px' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>You blocked {p.username}</p>
          <p style={{ margin: '6px 0 14px', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
            They can't see your stories or profile, follow you, comment or ask. You won't see theirs.
          </p>
          <BlockButton username={p.username} blocked onChange={() => setVersion((v) => v + 1)} />
        </div>
        <BottomNav />
      </div>
    );
  }
  const f = follow ?? { followers: p.followers, following: p.following, followedByMe: p.followedByMe };
  const all = trips.data ?? [];
  const full = all.filter((t) => t.kind === 'FULL');
  const shorts = all.filter((t) => t.kind === 'SHORT');
  const stats: [string, string][] = [[String(full.length), 'trips'], [String(shorts.length), 'short'], [String(f.followers), 'followers'], [String(f.following), 'following']];
  const shelves: [Shelf, string, number | null][] = [
    ['issues', 'Issues', full.length],
    ['shorts', 'Short stories', shorts.length],
    ...(isMe ? ([['want', 'Want to go', null], ['save', 'Saved', null]] as [Shelf, string, null][]) : []),
  ];

  async function toggleFollow() {
    if (!user) return navigate(`/signin?mode=join&next=${encodeURIComponent(`/u/${handle}`)}`);
    const on = !f.followedByMe;
    setFollow({ ...f, followedByMe: on, followers: f.followers + (on ? 1 : -1) });
    setBusy(true);
    try {
      setFollow(await api.follow(handle, on));
    } catch {
      setFollow(f);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <span style={{ fontSize: 15, fontWeight: 700 }}>@{p.username}</span>
        {isMe || !user
          ? <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon.settings /></Link>
          : <button type="button" className="icon-btn" aria-label="More options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}
              style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>⋯</button>}
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', gap: 18, alignItems: 'center' }}>
        <span style={{ flex: '0 0 auto', borderRadius: '50%', padding: p.premium ? 3 : 0, background: p.premium ? 'linear-gradient(135deg, #F6D58B, #E3A23B 55%, #B87A1E)' : 'none' }}>
          {isMe
            ? <Link to="/settings" aria-label="Change profile picture" style={{ display: 'block', borderRadius: '50%' }}><Avatar name={p.displayName} url={p.avatarUrl} size={84} ring="var(--card)" /></Link>
            : <Avatar name={p.displayName} url={p.avatarUrl} size={84} ring="var(--card)" />}
        </span>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.05, overflowWrap: 'anywhere' }}>{p.displayName}</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>@{p.username}</p>
          {p.premium && <PremiumBadge />}
        </div>
      </div>
      {p.bio
        ? <p style={{ margin: '16px 20px 0', fontSize: 15, lineHeight: 1.55, color: 'var(--ink-soft)', whiteSpace: 'pre-line' }}>{p.bio}</p>
        : isMe && <div style={{ padding: '14px 20px 0' }}><Link to="/settings" className="btn btn-outline" style={{ minHeight: 36, padding: '0 14px', fontSize: 13 }}>Add a short bio</Link></div>}

      <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
        {isMe ? (
          <Link to="/create" className="btn btn-primary" style={{ flex: 1, minHeight: 44 }}>New story</Link>
        ) : (
          <button type="button" className={f.followedByMe ? 'btn btn-outline' : 'btn btn-primary'} onClick={toggleFollow} disabled={busy}
            aria-pressed={f.followedByMe} style={{ flex: 1, minHeight: 44 }}>
            {f.followedByMe ? 'Following' : 'Follow'}
          </button>
        )}
        <button type="button" className="btn btn-outline" style={{ minHeight: 44, borderColor: 'var(--line-strong)' }}
          onClick={async () => setShared(await shareLink(`/s/u/${p.username}`, `${p.displayName} on Weyvo`))}>
          {shared === 'copied' ? 'Link copied' : 'Share profile'}
        </button>
      </div>

      {menu && user && !isMe && (
        <div style={{ padding: '12px 20px 0' }}>
          <BlockButton username={p.username} blocked={false} confirmNow onCancel={() => setMenu(false)}
            onChange={() => { setMenu(false); setFollow(null); setVersion((v) => v + 1); }} />
        </div>
      )}

      <div style={{ margin: '20px 20px 0' }}><TravelMap username={p.username} /></div>

      <div style={{ margin: '14px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', textAlign: 'center' }}>
        {stats.map(([n, l]) => (
          <div key={l}><p className="display" style={{ margin: 0, fontSize: 28 }}>{n}</p><p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>{l}</p></div>
        ))}
      </div>

      {/* One shelf at a time, so long lists never push the others far down the page. */}
      <div role="tablist" aria-label="Shelf" className="scroll-x" style={{ gap: 6, margin: '26px 20px 0', paddingBottom: 10, borderBottom: '1px solid var(--line-strong)' }}>
        {shelves.map(([id, label, count]) => (
          <button key={id} type="button" role="tab" className="tab" aria-selected={shelf === id} onClick={() => setShelf(id)} style={{ fontSize: 13, flex: '0 0 auto' }}>
            {label}{count !== null ? ` · ${count}` : ''}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ padding: '14px 20px 0' }}>
        {shelf === 'issues' && (trips.loading ? <Loading /> : full.length === 0 ? (
          <Empty title={isMe ? 'Your shelf is empty' : 'No issues yet'} body={isMe ? 'Publish a full trip and it appears here as an issue.' : `${p.displayName} hasn't published a full trip yet.`}
            cta={isMe ? { to: '/create', label: 'Create an issue' } : undefined} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            {full.map((t) => (
              <Link key={t.id} to={`/trips/${t.slug}`} className="lift" style={{ display: 'block', background: 'var(--card)', padding: 6, textDecoration: 'none' }}>
                <div className="cover" style={{ height: 200 }}>
                  <Photo scene={sceneFor(t.id)} src={t.cover?.thumbUrl} />
                  <div className="cover-overlay" style={{ padding: 10 }}>
                    <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase' }}>{t.status === 'DRAFT' ? 'Draft' : t.visibility === 'PUBLIC' ? t.place : t.visibility.toLowerCase()}</span>
                    <span className="display" style={{ fontSize: 20 }}>{t.title}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}
        {shelf === 'shorts' && (shorts.length === 0 ? (
          <Empty title="No short stories yet" body={isMe ? 'A weekend, a one-night stay, a long drive. Post one.' : `${p.displayName} hasn't posted a short story yet.`}
            cta={isMe ? { to: '/create?type=short', label: 'Post a short story' } : undefined} />
        ) : <TileGrid items={shorts} />)}
        {shelf === 'want' && <MyList type="want" empty="Tap Want to go on any story to plan your next trip." />}
        {shelf === 'save' && <MyList type="save" empty="Bookmark stories to read later." />}
      </div>
      <BottomNav />
    </div>
  );
}

/** The Premium mark: a small gold-foil pill with a star. */
function PremiumBadge() {
  return (
    <span title="Weyvo Premium member"
      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 9px', borderRadius: 999,
        background: 'linear-gradient(135deg, #F6D58B 0%, #E3A23B 55%, #C68A2B 100%)', color: '#2A1E08',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55), 0 2px 8px rgba(199,138,43,.35)',
        fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" /></svg>
      Premium
    </span>
  );
}

/** Block asks once before acting; unblock is immediate. */
function BlockButton({ username, blocked, onChange, confirmNow, onCancel }: { username: string; blocked: boolean; onChange: () => void; confirmNow?: boolean; onCancel?: () => void }) {
  const [confirming, setConfirming] = useState(!!confirmNow);
  const [error, setError] = useState('');

  async function run(on: boolean) {
    setError('');
    try {
      await api.block(username, on);
      setConfirming(false);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  if (blocked) {
    return (
      <>
        <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={() => run(false)}>Unblock</button>
        {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
      </>
    );
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)}
        style={{ border: 0, background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, minHeight: 32, padding: '6px 0' }}>Block</button>
    );
  }
  return (
    <div className="paper-card" style={{ textAlign: 'left', padding: '12px 14px' }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
        Block <strong>{username}</strong>? They won't see your stories or be able to follow, comment or ask. You won't see theirs.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" className="btn" style={{ minHeight: 38, background: '#B3261E', color: '#fff' }} onClick={() => run(true)}>Block</button>
        <button type="button" className="btn btn-outline" style={{ minHeight: 38 }} onClick={() => { setConfirming(false); onCancel?.(); }}>Cancel</button>
      </div>
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

/** Your private lists, shown only on your own profile. */
function MyList({ type, empty }: { type: 'save' | 'want'; empty: string }) {
  const { data, loading } = useApi(() => api.myList(type), [type]);
  if (loading && !data) return <Loading />;
  if (!data?.length) return <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)' }}>{empty} Only you see this list.</p>;
  return (
    <>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>Only you see this list.</p>
      <TileGrid items={data} />
    </>
  );
}

/** Three-across tiles for short stories and saved lists. */
function TileGrid({ items }: { items: TripCard[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {items.map((t) => (
        <Link key={t.id} to={`/trips/${t.slug}`} className="cover" style={{ height: 170, borderRadius: 12 }}>
          <Photo scene={sceneFor(t.id)} src={t.cover?.thumbUrl} />
          <span style={{ position: 'absolute', left: 7, right: 7, bottom: 7, textShadow: '0 1px 6px rgba(0,0,0,.45)' }}>
            <span style={{ display: 'block', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.place}</span>
            <span className="display" style={{ display: 'block', fontSize: 14 }}>{t.title}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
