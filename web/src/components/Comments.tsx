import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, ApiError, type Comment, type ReportReason } from '../api';
import { Avatar } from './Avatar';
import { useAuth } from '../auth';

const REASONS: { value: ReportReason; label: string }[] = [
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
    <section aria-labelledby="comments-title" style={{ marginTop: 32 }}>
      <h2 id="comments-title" className="eyebrow" style={{ margin: '0 0 12px', fontWeight: 600 }}>Comments · {count}</h2>
      {items.length === 0 && <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ink-soft)' }}>No comments yet. Say what this story made you feel.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} tripId={tripId} isOwner={isOwner} signedIn={!!user} onChange={load} canReply />
            {c.replies.length > 0 && (
              <div style={{ marginLeft: 34, marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.replies.map((r) => <CommentRow key={r.id} c={r} tripId={tripId} isOwner={isOwner} signedIn={!!user} onChange={load} />)}
              </div>
            )}
          </div>
        ))}
      </div>

      {user ? (
        <Composer tripId={tripId} onPosted={load} label="Add a comment" />
      ) : (
        <p style={{ marginTop: 14, fontSize: 14 }}><Link to={`/signin?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> to comment.</p>
      )}
    </section>
  );
}

function Composer({ tripId, parentId, onPosted, label, onCancel }: {
  tripId: number; parentId?: number; onPosted: () => void; label: string; onCancel?: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = parentId ? `reply-${parentId}` : 'comment';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.postComment(tripId, text, parentId);
      setText('');
      onPosted();
      onCancel?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      <label htmlFor={id} className="field-label" style={{ fontWeight: 400, color: 'var(--muted)' }}>{label} · {text.length} / 500</label>
      <textarea id={id} className="input" rows={2} maxLength={500} value={text} onChange={(e) => { setText(e.target.value); setError(''); }} />
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()} style={{ minHeight: 40, opacity: busy || !text.trim() ? 0.6 : 1 }}>
          {busy ? 'Posting…' : parentId ? 'Reply' : 'Comment'}
        </button>
        {onCancel && <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function CommentRow({ c, tripId, isOwner, signedIn, onChange, canReply }: {
  c: Comment; tripId: number; isOwner: boolean; signedIn: boolean; onChange: () => void; canReply?: boolean;
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
    <article style={{ display: 'flex', gap: 10, opacity: hidden ? 0.6 : 1 }}>
      <Link to={`/u/${c.author.username}`} aria-label={c.author.displayName}><Avatar name={c.author.displayName} url={c.author.avatarUrl} size={28} /></Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          <Link to={`/u/${c.author.username}`} style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{c.author.displayName}</Link>{' '}
          {hidden && <span className="tag" style={{ fontSize: 10, background: 'var(--line)' }}>{c.status === 'HIDDEN_BY_REPORTS' ? 'Hidden after reports' : 'Hidden'}</span>}{' '}
          <span style={{ color: 'var(--ink-soft)', overflowWrap: 'anywhere' }}>{c.body}</span>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {canReply && signedIn && !hidden && <Small onClick={() => setReplying(!replying)}>{replying ? 'Cancel' : 'Reply'}</Small>}
          {isOwner && <Small onClick={() => run(() => api.setCommentHidden(c.id, !hidden))}>{hidden ? 'Show' : 'Hide'}</Small>}
          {(isOwner || c.mine) && <Small onClick={() => run(() => api.deleteComment(c.id))}>Delete</Small>}
          {signedIn && !c.mine && !isOwner && !reported && <Small onClick={() => setReporting(!reporting)}>{reporting ? 'Cancel' : 'Report'}</Small>}
          {reported && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 6px' }}>Thanks, we'll take a look.</span>}
        </div>
        {reporting && (
          <div role="group" aria-label="Report reason" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REASONS.map((r) => (
              <button key={r.value} type="button" className="pill" style={{ minHeight: 34, fontSize: 12 }}
                onClick={() => run(async () => { await api.reportComment(c.id, r.value); setReporting(false); setReported(true); })}>{r.label}</button>
            ))}
          </div>
        )}
        {replying && <Composer tripId={tripId} parentId={c.id} onPosted={onChange} label={`Reply to ${c.author.displayName.split(' ')[0]}`} onCancel={() => setReplying(false)} />}
        {error && <p role="alert" style={{ margin: '4px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
      </div>
    </article>
  );
}

function Small({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ border: 0, background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, padding: '8px 6px', minHeight: 32 }}>
      {children}
    </button>
  );
}
