import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, type Notification } from '../api';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Empty, ErrorNote, Loading } from '../components/States';
import { useApi } from '../useApi';
import { BackButton } from '../components/BackButton';

export function Notifications() {
  const { signedIn, loading: authLoading } = useAuth();
  const { data, error, loading } = useApi(() => (signedIn ? api.notifications() : Promise.resolve([])), [signedIn]);

  // Opening the page counts as reading everything on it.
  useEffect(() => {
    if (signedIn && data?.some((n) => !n.read)) api.markNotificationsRead().catch(() => {});
  }, [signedIn, data]);

  if (authLoading) return null;
  if (!signedIn) return <Navigate to="/signin?next=/notifications" replace />;

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <BackButton fallback="/discover" />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Notifications</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display" style={{ margin: '8px 0 18px', fontSize: 38 }}>What's new</h1>
        {loading ? <Loading /> : error ? <ErrorNote message={error.message} /> : !data?.length ? (
          <Empty title="All quiet" body="When someone follows you, reacts, comments, replies or asks about a trip, you'll see it here." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.map((n) => <Row key={n.id} n={n} />)}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function Row({ n }: { n: Notification }) {
  const target = n.type === 'FOLLOW' || !n.trip ? `/u/${n.actor.username}` : `/trips/${n.trip.slug}`;
  return (
    <li style={{ borderBottom: '1px solid var(--line)' }}>
      <Link to={target} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 0', textDecoration: 'none', color: 'var(--ink)' }}>
        <Avatar name={n.actor.displayName} url={n.actor.avatarUrl} size={40} />
        <span style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}>
          <strong>{n.actor.username}</strong> {sentence(n)}
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{ago(n.createdAt)}</span>
        </span>
        {!n.read && <span aria-label="New" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0 }} />}
      </Link>
    </li>
  );
}

function sentence(n: Notification) {
  const title = n.trip ? `“${n.trip.title}”` : 'your story';
  switch (n.type) {
    case 'FOLLOW': return 'started following you';
    case 'BEEN': return `has been to the place in ${title}`;
    case 'WANT': return `wants to go after reading ${title}`;
    case 'QUESTION': return `asked you a question on ${title}`;
    case 'ANSWER': return `answered your question on ${title}`;
    case 'COMMENT': return `commented on ${title}`;
    case 'REPLY': return `replied to your comment on ${title}`;
  }
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}
