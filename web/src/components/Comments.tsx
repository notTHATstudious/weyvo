import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, ApiError, type Comment, type ReportReason } from '../api';
import { Avatar } from './Avatar';
import { useAuth } from '../auth';
import { TalkAction, TalkComposer, TalkHeading, ago } from './Talk';

export const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'ABUSE', label: 'Abusive' },
  { value: 'OFF_TOPIC', label: 'Off topic' },
  { value: 'OTHER', label: 'Something else' },
];

/** Open comments with one level of replies. The story's author can hide or delete any comment. */
export function Comments({ tripId, isOwner }: { tripId: number; isOwner: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState<Comment[] | null>(null);

  const load = () => api.comments(tripId).then((c) => setItems(c.items), () => setItems([]));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, user?.id]);

  if (items === null) return null;
  const count = items.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <section aria-labelledby="comments-title" style={{ marginTop: 36 }}>
      <TalkHeading id="comments-title" title="Comments" count={count} />
      {items.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-soft)' }}>No comments yet. Say what this story made you feel.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {items.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} tripId={tripId} isOwner={isOwner} signedIn={!!user} onChange={load} canReply />
            {c.replies.length > 0 && (
              <div style={{ marginLeft: 46, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {c.replies.map((r) => <CommentRow key={r.id} c={r} tripId={tripId} isOwner={isOwner} signedIn={!!user} onChange={load} small />)}
              </div>
            )}
          </div>
        ))}
      </div>

      {user ? (
        <TalkComposer id="comment" label="Add a comment" placeholder="Add a comment…" max={500} button="Post comment"
          onSend={async (text) => { await send(() => api.postComment(tripId, text)); load(); }} />
      ) : (
        <p style={{ marginTop: 14, fontSize: 14 }}><Link to={`/signin?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> to comment.</p>
      )}
    </section>
  );
}

/** Turns API errors into plain messages for the message box. */
async function send(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
  }
}

function CommentRow({ c, tripId, isOwner, signedIn, onChange, canReply, small }: {
  c: Comment; tripId: number; isOwner: boolean; signedIn: boolean; onChange: () => void; canReply?: boolean; small?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState('');
  const hidden = c.status && c.status !== 'VISIBLE';

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <article style={{ display: 'flex', gap: 12, opacity: hidden ? 0.6 : 1 }}>
      <Link to={`/u/${c.author.username}`} aria-label={c.author.displayName} style={{ flex: '0 0 auto' }}>
        <Avatar name={c.author.displayName} url={c.author.avatarUrl} size={small ? 28 : 34} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'inline-block', maxWidth: '100%', padding: '9px 14px 10px', borderRadius: '4px 18px 18px 18px', background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p style={{ margin: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Link to={`/u/${c.author.username}`} style={{ fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }}>{c.author.username}</Link>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {ago(c.createdAt)}</span>
            {hidden && <span className="tag" style={{ fontSize: 10, background: 'var(--line)' }}>{c.status === 'HIDDEN_BY_REPORTS' ? 'Hidden after reports' : 'Hidden'}</span>}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 15, lineHeight: 1.45, color: 'var(--ink)', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{c.body}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 14 }}>
          {canReply && signedIn && !hidden && <TalkAction onClick={() => setReplying(!replying)}>{replying ? 'Cancel' : 'Reply'}</TalkAction>}
          {isOwner && <TalkAction onClick={() => run(() => api.setCommentHidden(c.id, !hidden))}>{hidden ? 'Show' : 'Hide'}</TalkAction>}
          {(isOwner || c.mine) && <TalkAction onClick={() => run(() => api.deleteComment(c.id))}>Delete</TalkAction>}
          {signedIn && !c.mine && !isOwner && !reported && <TalkAction onClick={() => setReporting(!reporting)}>{reporting ? 'Cancel' : 'Report'}</TalkAction>}
          {reported && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0' }}>Thanks, we'll take a look.</span>}
        </div>
        {reporting && (
          <div role="group" aria-label="Report reason" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REASONS.map((r) => (
              <button key={r.value} type="button" className="pill" style={{ minHeight: 34, fontSize: 12 }}
                onClick={() => run(async () => { await api.reportComment(c.id, r.value); setReporting(false); setReported(true); })}>{r.label}</button>
            ))}
          </div>
        )}
        {replying && (
          <TalkComposer id={`reply-${c.id}`} label={`Reply to ${c.author.displayName}`} placeholder={`Reply to ${c.author.username}…`} max={500} button="Post reply" autoFocus
            onSend={async (text) => { await send(() => api.postComment(tripId, text, c.id)); setReplying(false); onChange(); }} onCancel={() => setReplying(false)} />
        )}
        {error && <p role="alert" style={{ margin: '4px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
      </div>
    </article>
  );
}
