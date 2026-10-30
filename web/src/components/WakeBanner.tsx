import { useEffect, useState } from 'react';
import { onSlowRequests } from '../api';

/**
 * Shown while requests are slow, which on the free host usually means the server is starting up.
 * A small "Updating…" pill first (the page already shows what was saved on the device); the longer
 * explanation only if it's still waiting after 15 seconds.
 */
export function WakeBanner() {
  const [slow, setSlow] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => onSlowRequests(setSlow), []);
  useEffect(() => {
    if (!slow) {
      setLong(false);
      return;
    }
    const t = setTimeout(() => setLong(true), 11_000);
    return () => clearTimeout(t);
  }, [slow]);
  if (!slow) return null;
  return (
    <div role="status" style={{ position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', zIndex: 80,
      maxWidth: 'min(92vw, 420px)', background: '#1C1B18', color: '#FBF8F2', borderRadius: 999, padding: long ? '10px 16px' : '7px 14px',
      fontSize: long ? 13 : 12, lineHeight: 1.4, boxShadow: '0 6px 20px rgba(0,0,0,.25)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', flex: '0 0 8px', animation: 'pulse 1.2s ease-in-out infinite' }} />
      <span>{long ? 'Waking Weyvo up. This can take up to a minute after a quiet spell.' : 'Updating…'}</span>
    </div>
  );
}
