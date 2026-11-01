import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, type FollowPerson } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { BottomNav } from '../components/BottomNav';
import { Empty, ErrorNote, Loading } from '../components/States';
import { useApi } from '../useApi';

type Which = 'followers' | 'following';

/** Who follows someone, and who they follow, with a Follow button beside each person. */
export function FollowList() {
  const { handle = '', list = 'followers' } = useParams();
  const which: Which = list === 'following' ? 'following' : 'followers';
  const navigate = useNavigate();
  const { data, loading, error, retry } = useApi(() => api.followList(handle, which), [handle, which]);

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <BackButton fallback={`/u/${handle}`} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>@{handle}</span>
        <span style={{ width: 44 }} />
      </div>
      <div role="tablist" aria-label="Followers and following" style={{ display: 'flex', gap: 6, padding: '6px 20px 12px' }}>
        {(['followers', 'following'] as Which[]).map((w) => (
          <button key={w} type="button" role="tab" className="tab" aria-selected={which === w}
            onClick={() => navigate(`/u/${handle}/${w}`, { replace: true })} style={{ fontSize: 13 }}>
            {w === 'followers' ? 'Followers' : 'Following'}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 20px' }}>
        {loading && !data ? <Loading /> : error ? <ErrorNote message={error.message} onRetry={retry} /> : !data?.length ? (
          <Empty title={which === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            body={which === 'followers' ? 'When people follow this traveller, they show up here.' : 'People this traveller follows show up here.'} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.map((p) => <PersonRow key={p.username} p={p} />)}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function PersonRow({ p }: { p: FollowPerson }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [on, setOn] = useState(p.followedByMe);
  const [busy, setBusy] = useState(false);
  const isMe = user?.username.toLowerCase() === p.username.toLowerCase();

  async function toggle() {
    if (!user) return navigate(`/signin?mode=join&next=${encodeURIComponent(`/u/${p.username}`)}`);
    setBusy(true);
    setOn(!on);
    try {
      await api.follow(p.username, !on);
    } catch (err) {
      setOn(on);
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <Link to={`/u/${p.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, color: 'var(--ink)', textDecoration: 'none' }}>
        <Avatar name={p.displayName} url={p.avatarUrl} size={46} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</span>
          <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</span>
        </span>
      </Link>
      {!isMe && (
        <button type="button" className={on ? 'btn btn-outline' : 'btn btn-primary'} aria-pressed={on} disabled={busy} onClick={toggle}
          style={{ minHeight: 36, padding: '0 16px', fontSize: 13, flex: '0 0 auto' }}>
          {on ? 'Following' : 'Follow'}
        </button>
      )}
    </li>
  );
}
