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

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="paper-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <p style={{ fontSize: 14, color: '#B3261E', margin: 0 }}>{message}</p>
      {onRetry && <button type="button" className="btn btn-outline" style={{ minHeight: 38 }} onClick={onRetry}>Try again</button>}
    </div>
  );
}
