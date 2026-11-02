import { useState, type FormEvent, type ReactNode } from 'react';
import { Avatar } from './Avatar';
import { useAuth } from '../auth';

/** Shared look for the conversation under a story: section headings, the message box and "2h ago" times. */

export function TalkHeading({ id, title, count, hint }: { id: string; title: string; count: number; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 14px' }}>
      <h2 id={id} className="display" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h2>
      {count > 0 && <span className="tag" style={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--line)' }}>{count}</span>}
      {hint && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{hint}</span>}
    </div>
  );
}

/** A rounded message box with your photo on the left and a round send button that lights up once you type. */
export function TalkComposer({ id, label, placeholder, max, button, onSend, onCancel, autoFocus }: {
  id: string; label: string; placeholder: string; max: number; button: string;
  onSend: (text: string) => Promise<void>; onCancel?: () => void; autoFocus?: boolean;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !!text.trim() && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      await onSend(text);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 14 }}>
      <label htmlFor={id} className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '8px 8px 8px 10px', borderRadius: 26,
        background: 'var(--card)', border: '1px solid var(--line)', boxShadow: '0 6px 20px rgba(0,0,0,.08)' }}>
        {user && <span style={{ flex: '0 0 auto', paddingBottom: 2 }}><Avatar name={user.displayName} url={user.avatarUrl ?? null} size={32} /></span>}
        <textarea id={id} rows={1} maxLength={max} value={text} placeholder={placeholder} autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setError(''); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)',
            font: 'inherit', fontSize: 15, lineHeight: 1.4, padding: '8px 0', maxHeight: 140 }} />
        <button type="submit" aria-label={button} disabled={!ready}
          style={{ flex: '0 0 auto', width: 38, height: 38, borderRadius: 999, border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: ready ? 'var(--green)' : 'var(--line)', color: ready ? 'var(--on-green)' : 'var(--muted)', transition: 'background .15s, color .15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 22, padding: '4px 14px 0' }}>
        {error ? <p role="alert" style={{ margin: 0, fontSize: 13, color: '#B3261E' }}>{error}</p>
          : text.length > max * 0.8 ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>{max - text.length} left</span> : null}
        {onCancel && <button type="button" onClick={onCancel} style={{ marginLeft: 'auto', border: 0, background: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, minHeight: 28 }}>Cancel</button>}
      </div>
    </form>
  );
}

export function TalkAction({ children, onClick, tone = 'muted' }: { children: ReactNode; onClick: () => void; tone?: 'muted' | 'green' }) {
  return (
    <button type="button" onClick={onClick}
      style={{ border: 0, background: 'none', color: tone === 'green' ? 'var(--green)' : 'var(--muted)', fontSize: 12, fontWeight: 600, padding: '6px 8px 6px 0', minHeight: 32 }}>
      {children}
    </button>
  );
}

/** "now", "5m", "3h", "2d", then a short date. */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
