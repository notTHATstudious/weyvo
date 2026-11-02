import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, ApiError, type Question, type ReportReason } from '../api';
import { Avatar } from './Avatar';
import { useAuth } from '../auth';
import { TalkAction, TalkComposer, TalkHeading, ago } from './Talk';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'ABUSE', label: 'Abusive' },
  { value: 'OFF_TOPIC', label: 'Off topic' },
  { value: 'OTHER', label: 'Something else' },
];

/** "Ask the traveller": readers ask, the author answers and moderates. */
export function QnA({ tripId, isOwner, authorName }: { tripId: number; isOwner: boolean; authorName: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState<Question[] | null>(null);
  const firstName = authorName.split(' ')[0];

  useEffect(() => {
    api.questions(tripId).then((q) => setItems(q.items), () => setItems([]));
  }, [tripId, user?.id]);

  const replace = (q: Question) => setItems((xs) => (xs ?? []).map((x) => (x.id === q.id ? q : x)));
  const remove = (id: number) => setItems((xs) => (xs ?? []).filter((x) => x.id !== id));

  if (items === null) return null;

  return (
    <section aria-labelledby="qna-title" style={{ marginTop: 36 }}>
      <TalkHeading id="qna-title" title="Ask the traveller" count={items.length} hint={items.some((q) => q.answer) ? `${items.filter((q) => q.answer).length} answered` : undefined} />

      {items.length === 0 && (
        <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-soft)' }}>
          {isOwner ? 'No questions yet. Readers can ask you anything about this trip.' : `No questions yet. Ask ${firstName} about this trip.`}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((q) => (
          <QuestionCard key={q.id} q={q} isOwner={isOwner} signedIn={!!user} authorName={authorName} onChange={replace} onRemove={remove} />
        ))}
      </div>

      {!isOwner && (user ? (
        <TalkComposer id="ask" label={`Ask ${firstName} something`} placeholder={`Ask ${firstName} — best month to go?`} max={300} button="Ask"
          onSend={async (text) => {
            try {
              const q = await api.ask(tripId, text);
              setItems((xs) => [...(xs ?? []), q]);
            } catch (err) {
              throw new Error(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
            }
          }} />
      ) : (
        <p style={{ marginTop: 14, fontSize: 14 }}>
          <Link to={`/signin?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> to ask {firstName} a question.
        </p>
      ))}
    </section>
  );
}

function QuestionCard({ q, isOwner, signedIn, authorName, onChange, onRemove }: {
  q: Question; isOwner: boolean; signedIn: boolean; authorName: string;
  onChange: (q: Question) => void; onRemove: (id: number) => void;
}) {
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState(q.answer ?? '');
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState('');
  const hidden = q.status && q.status !== 'VISIBLE';

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <article style={{ opacity: hidden ? 0.6 : 1, borderRadius: 20, padding: 16, background: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 6px 20px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={q.asker.displayName} url={q.asker.avatarUrl} size={30} />
        <p style={{ margin: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          <Link to={`/u/${q.asker.username}`} style={{ fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }}>{q.asker.username}</Link>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>asked · {ago(q.createdAt)}</span>
          {hidden && <span className="tag" style={{ fontSize: 10, background: 'var(--line)' }}>{q.status === 'HIDDEN_BY_REPORTS' ? 'Hidden after reports' : 'Hidden'}</span>}
        </p>
      </div>
      <p className="display" style={{ margin: '10px 0 0', fontSize: 20, lineHeight: 1.3, fontWeight: 600, overflowWrap: 'anywhere' }}>{q.body}</p>

      {q.answer && !answering && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 14, borderLeft: '3px solid var(--green)',
          background: 'color-mix(in srgb, var(--green) 12%, transparent)' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--green)' }}>{authorName.split(' ')[0]} answered</p>
          <p style={{ margin: '4px 0 0', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{q.answer}</p>
        </div>
      )}
      {!q.answer && !answering && !isOwner && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>Waiting for {authorName.split(' ')[0]}'s answer</p>}

      {isOwner && answering && (
        <div style={{ marginTop: 10 }}>
          <label htmlFor={`ans${q.id}`} className="field-label">Your answer · {answer.length} / 500</label>
          <textarea id={`ans${q.id}`} className="input" rows={3} maxLength={500} value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" style={{ minHeight: 40 }} disabled={!answer.trim()}
              onClick={() => run(async () => { onChange(await api.answer(q.id, answer)); setAnswering(false); })}>Post answer</button>
            <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={() => setAnswering(false)}>Cancel</button>
          </div>
        </div>
      )}

      {reporting && (
        <div role="group" aria-label="Report reason" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {REASONS.map((r) => (
            <button key={r.value} type="button" className="pill" style={{ minHeight: 34, fontSize: 12 }}
              onClick={() => run(async () => { await api.report(q.id, r.value); setReporting(false); setReported(true); })}>{r.label}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {isOwner && !answering && <TalkAction tone="green" onClick={() => setAnswering(true)}>{q.answer ? 'Edit answer' : 'Answer'}</TalkAction>}
        {isOwner && <TalkAction onClick={() => run(async () => onChange(await api.setHidden(q.id, !hidden)))}>{hidden ? 'Show' : 'Hide'}</TalkAction>}
        {(isOwner || q.mine) && <TalkAction onClick={() => run(async () => { await api.deleteQuestion(q.id); onRemove(q.id); })}>Delete</TalkAction>}
        {signedIn && !isOwner && !q.mine && !reported && <TalkAction onClick={() => setReporting(!reporting)}>{reporting ? 'Cancel' : 'Report'}</TalkAction>}
        {reported && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0' }}>Thanks, we'll take a look.</span>}
      </div>
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </article>
  );
}
