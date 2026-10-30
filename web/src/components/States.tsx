import { Link } from 'react-router-dom';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ height: i ? 120 : 320, borderRadius: 'var(--radius)', background: 'var(--line)', opacity: 0.6, animation: 'pulse 1.2s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

export function Empty({ title, body, cta }: { title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="paper-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
      <p className="display" style={{ margin: 0, fontSize: 26 }}>{title}</p>
      <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{body}</p>
      {cta && <Link to={cta.to} className="btn btn-primary" style={{ marginTop: 18 }}>{cta.label}</Link>}
    </div>
  );
}

/** Turns a raw error into words a reader can act on. */
export function friendly(message: string): { title: string; body: string } {
  const m = message.toLowerCase();
  if (m.includes('waking')) return { title: 'Weyvo is waking up', body: 'After a quiet spell the first visit takes up to a minute. Try again in a moment.' };
  if (m.includes('offline') || m.includes("can't reach")) return { title: "You're offline", body: 'Check your connection, then try again.' };
  if (m.includes('not found')) return { title: "We couldn't find that", body: 'It may have moved or been removed. Try again, or head back to Discover.' };
  if (m.includes('too many') || m.includes('slow down') || m.includes('a lot in the last hour')) return { title: 'Take a short break', body: message };
  if (m.includes('sign in')) return { title: 'Please sign in', body: message };
  if (m === 'something went wrong' || m.startsWith('something went wrong')) return { title: 'Something went wrong', body: "It's not you. Try again in a moment." };
  return { title: 'That didn’t work', body: message };
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { title, body } = friendly(message);
  return (
    <div role="alert" className="paper-card rise" style={{ textAlign: 'center', padding: '28px 20px' }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
        background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-fg)', fontSize: 24, fontWeight: 700 }}>!</span>
      <p className="display" style={{ margin: '14px 0 0', fontSize: 24 }}>{title}</p>
      <p style={{ margin: '8px auto 0', maxWidth: 320, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{body}</p>
      {onRetry && <button type="button" className="btn btn-primary" style={{ marginTop: 16, minHeight: 42 }} onClick={onRetry}>Try again</button>}
    </div>
  );
}
