import { useEffect, useState } from 'react';
import { onSlowRequests } from '../api';

/** Shown while requests are slow, which on the free host usually means the server is starting up. */
export function WakeBanner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequests(setSlow), []);
  if (!slow) return null;
  return (
    <div role="status" style={{ position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', zIndex: 80,
      width: 'min(92vw, 420px)', background: '#1C1B18', color: '#FBF8F2', borderRadius: 14, padding: '10px 14px', fontSize: 13, lineHeight: 1.4,
      boxShadow: '0 6px 20px rgba(0,0,0,.25)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold)', flex: '0 0 10px', animation: 'pulse 1.2s ease-in-out infinite' }} />
      <span>Waking Weyvo up. The first visit after a quiet spell can take up to a minute.</span>
    </div>
  );
}
