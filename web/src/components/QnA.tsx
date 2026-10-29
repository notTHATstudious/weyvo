import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, ApiError, avatarOf, type Question, type ReportReason } from '../api';
import { useAuth } from '../auth';

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
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstName = authorName.split(' ')[0];

  useEffect(() => {
    api.questions(tripId).then((q) => setItems(q.items), () => setItems([]));
  }, [tripId, user?.id]);

  const replace = (q: Question) => setItems((xs) => (xs ?? []).map((x) => (x.id === q.id ? q : x)));
  const remove = (id: number) => setItems((xs) => (xs ?? []).filter((x) => x.id !== id));

  async function ask(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const q = await api.ask(tripId, draft);
      setItems((xs) => [...(xs ?? []), q]);
      setDraft('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (items === null) return null;

  return (
    <section aria-labelledby="qna-title" style={{ marginTop: 32 }}>
      <h2 id="qna-title" className="eyebrow" style={{ margin: '0 0 12px', fontWeight: 600 }}>Ask the traveller · {items.length}</h2>

      {items.length === 0 && (
        <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ink-soft)' }}>
          {isOwner ? 'No questions yet. Readers can ask you anything about this trip.' : `No questions yet. Ask ${firstName} about this trip.`}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((q) => (
          <QuestionCard key={q.id} q={q} isOwner={isOwner} signedIn={!!user} authorName={authorName} onChange={replace} onRemove={remove} />
        ))}
      </div>

      {!isOwner && (user ? (
        <form onSubmit={ask} style={{ marginTop: 14 }}>
          <label htmlFor="ask" className="field-label" style={{ fontWeight: 400, color: 'var(--muted)' }}>Ask {firstName} something · {draft.length} / 300</label>
          <textarea id="ask" className="input" rows={2} maxLength={300} value={draft} onChange={(e) => { setDraft(e.target.value); setError(''); }}
            placeholder="Best month to go?" />
          {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()} style={{ marginTop: 10, opacity: busy || !draft.trim() ? 0.6 : 1 }}>
            {busy ? 'Posting…' : 'Ask'}
          </button>
        </form>
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
  const a = avatarOf(q.asker.displayName);
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
    <article className="paper-card" style={{ opacity: hidden ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', background: a.color, color: '#FBF8F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{a.initial}</span>
        <Link to={`/u/${q.asker.username}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>{q.asker.displayName}</Link>
        {hidden && <span className="tag" style={{ fontSize: 10, background: 'var(--line)' }}>{q.status === 'HIDDEN_BY_REPORTS' ? 'Hidden after reports' : 'Hidden'}</span>}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 600 }}>{q.body}</p>

      {q.answer && !answering && (
        <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
          <strong style={{ color: 'var(--green)' }}>{authorName.split(' ')[0]}:</strong> {q.answer}
        </p>
      )}

      {isOwner && answering && (
        <div style={{ marginTop: 10 }}>
          <label htmlFor={`ans${q.id}`} className="field-label">Your answer · {answer.length} / 500</label>
          <textarea id={`ans${q.id}`} className="input" rows={3} maxLength={500} value={answer} onChange={(e) => setAnswer(e.target.value)} />
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {isOwner && !answering && <SmallButton onClick={() => setAnswering(true)}>{q.answer ? 'Edit answer' : 'Answer'}</SmallButton>}
        {isOwner && <SmallButton onClick={() => run(async () => onChange(await api.setHidden(q.id, !hidden)))}>{hidden ? 'Show' : 'Hide'}</SmallButton>}
        {(isOwner || q.mine) && <SmallButton onClick={() => run(async () => { await api.deleteQuestion(q.id); onRemove(q.id); })}>Delete</SmallButton>}
        {signedIn && !isOwner && !q.mine && !reported && <SmallButton onClick={() => setReporting(!reporting)}>{reporting ? 'Cancel' : 'Report'}</SmallButton>}
        {reported && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 6px' }}>Thanks, we'll take a look.</span>}
      </div>
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </article>
  );
}

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ border: 0, background: 'none', color: 'var(--green)', fontSize: 13, fontWeight: 600, padding: '8px 6px', minHeight: 36 }}>
      {children}
    </button>
  );
}
