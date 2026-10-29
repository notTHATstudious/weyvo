import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

/** Shown across the app until the signed-in user verifies their email. */
export function VerifyBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user || user.emailVerified || pathname === '/verify' || pathname === '/shorts') return null;
  return (
    <div role="status" style={{ background: 'var(--gold)', color: 'var(--on-gold)', fontSize: 14 }}>
      <div style={{ maxWidth: 'var(--app-w)', margin: '0 auto', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <span>Verify your email to post, react and follow.</span>
        <Link to={`/verify?next=${encodeURIComponent(pathname)}`} style={{ color: 'var(--on-gold)', fontWeight: 700, whiteSpace: 'nowrap' }}>Enter code</Link>
      </div>
    </div>
  );
}
