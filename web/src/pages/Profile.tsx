import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, sceneFor, type FollowStats } from '../api';
import { Avatar } from '../components/Avatar';
import { shareLink } from '../share';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Empty, Loading } from '../components/States';
import { TravelMap } from '../components/TravelMap';
import { useApi } from '../useApi';

export function Profile() {
  const { handle = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [follow, setFollow] = useState<FollowStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const isMe = user?.username.toLowerCase() === handle.toLowerCase();

  const person = useApi(() => api.user(handle), [handle, user?.id]);
  // Your own profile includes drafts and private trips; anyone else's shows public ones only.
  const trips = useApi(() => (isMe ? api.myTrips() : api.userTrips(handle)), [handle, isMe]);

  if (person.loading) return <div className="app" style={{ padding: 20 }}><Loading /></div>;
  if (!person.data) {
    return <div className="app" style={{ padding: 20 }}><Empty title="No one here" body="This traveller doesn't exist or has left Weyvo." cta={{ to: '/discover', label: 'Back to Discover' }} /><BottomNav /></div>;
  }

  const p = person.data;
  const f = follow ?? { followers: p.followers, following: p.following, followedByMe: p.followedByMe };
  const all = trips.data ?? [];
  const full = all.filter((t) => t.kind === 'FULL');
  const shorts = all.filter((t) => t.kind === 'SHORT');
  const stats: [string, string][] = [[String(full.length), 'trips'], [String(shorts.length), 'short'], [String(f.followers), 'followers'], [String(f.following), 'following']];

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
        <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon.settings /></Link>
      </div>

      <div style={{ padding: '4px 20px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
        {isMe
          ? <Link to="/settings" aria-label="Change profile picture" style={{ borderRadius: '50%' }}><Avatar name={p.displayName} url={p.avatarUrl} size={80} ring="var(--card)" /></Link>
          : <Avatar name={p.displayName} url={p.avatarUrl} size={80} ring="var(--card)" />}
        <div style={{ minWidth: 0 }}>
          <h1 className="display" style={{ margin: 0, fontSize: 30 }}>{p.displayName}</h1>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--muted)' }}>@{p.username}
            {p.premium && <span className="tag tag-gold" style={{ marginLeft: 8, fontSize: 10, letterSpacing: '.08em' }}>★ PREMIUM</span>}
          </p>
          {p.bio
            ? <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.45, color: 'var(--ink-soft)' }}>{p.bio}</p>
            : isMe && <Link to="/settings" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 600 }}>Add a short bio</Link>}
        </div>
      </div>

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
          onClick={async () => setShared(await shareLink(`/u/${p.username}`, `${p.displayName} on Weyvo`))}>
          {shared === 'copied' ? 'Link copied' : 'Share profile'}
        </button>
      </div>

      {/* Sample pins until trips carry real place data. */}
      <div style={{ margin: '20px 20px 0' }}><TravelMap /></div>

      <div style={{ margin: '14px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', textAlign: 'center' }}>
        {stats.map(([n, l]) => (
          <div key={l}><p className="display" style={{ margin: 0, fontSize: 28 }}>{n}</p><p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>{l}</p></div>
        ))}
      </div>

      <div style={{ margin: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--ink)', paddingBottom: 8 }}>
        <h2 className="display" style={{ margin: 0, fontSize: 26 }}>The issues</h2><span style={{ fontSize: 12, color: 'var(--muted)' }}>{full.length} full trips</span>
      </div>
      <div style={{ padding: '14px 20px 0' }}>
        {trips.loading ? <Loading /> : full.length === 0 ? (
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
        )}
      </div>

      {shorts.length > 0 && (
        <>
          <div style={{ margin: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--ink)', paddingBottom: 8 }}>
            <h2 className="display" style={{ margin: 0, fontSize: 26 }}>Short stories</h2>
          </div>
          <div className="scroll-x" style={{ gap: 10, padding: '14px 20px 0' }}>
            {shorts.map((s) => (
              <Link key={s.id} to={`/trips/${s.slug}`} className="cover" style={{ flex: '0 0 120px', height: 180, borderRadius: 14 }}>
                <Photo scene={sceneFor(s.id)} src={s.cover?.thumbUrl} />
                <span className="display" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, fontSize: 15, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>{s.title}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {isMe && <MyList type="want" title="Want to go" empty="Tap Want to go on any story to plan your next trip." />}
      {isMe && <MyList type="save" title="Saved" empty="Bookmark stories to read later. Only you see this list." />}
      <BottomNav />
    </div>
  );
}

/** Your private lists, shown only on your own profile. */
function MyList({ type, title, empty }: { type: 'save' | 'want'; title: string; empty: string }) {
  const { data, loading } = useApi(() => api.myList(type), [type]);
  const items = data ?? [];
  return (
    <>
      <div style={{ margin: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--ink)', paddingBottom: 8 }}>
        <h2 className="display" style={{ margin: 0, fontSize: 26 }}>{title}</h2><span style={{ fontSize: 12, color: 'var(--muted)' }}>Only you see this</span>
      </div>
      {loading ? null : items.length === 0 ? (
        <p style={{ margin: '12px 20px 0', fontSize: 14, color: 'var(--ink-soft)' }}>{empty}</p>
      ) : (
        <div className="scroll-x" style={{ gap: 10, padding: '14px 20px 0' }}>
          {items.map((t) => (
            <Link key={t.id} to={`/trips/${t.slug}`} className="cover" style={{ flex: '0 0 140px', height: 180, borderRadius: 14 }}>
              <Photo scene={sceneFor(t.id)} src={t.cover?.thumbUrl} />
              <span style={{ position: 'absolute', left: 8, right: 8, bottom: 8, textShadow: '0 1px 6px rgba(0,0,0,.45)' }}>
                <span style={{ display: 'block', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' }}>{t.place}</span>
                <span className="display" style={{ display: 'block', fontSize: 16 }}>{t.title}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
