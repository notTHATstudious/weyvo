import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { safeNext } from './SignIn';
import { Wordmark } from '../components/Wordmark';

const COOLDOWN = 60;

/** "Check your email": enter the 6-digit code sent at sign-up. */
export function VerifyEmail() {
  const { user, loading, verifyEmail, logout } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(COOLDOWN);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (loading) return null;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent('/verify')}`} replace />;
  if (user.emailVerified) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await verifyEmail(code);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setNotice('');
    try {
      await api.resendCode();
      setNotice('New code sent. Check your inbox and spam folder.');
      setWait(COOLDOWN);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to="/discover" className="icon-btn" aria-label="Back"><Icon.back /></Link>
        <Wordmark size={22} />
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display rise" style={{ margin: '24px 0 0', fontSize: 38 }}>Check your email</h1>
        <p style={{ margin: '10px 0 24px', fontSize: 15, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
          We sent a 6-digit code to the email you signed up with. It expires in 10 minutes.
        </p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="code" className="field-label">Code</label>
          <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }} placeholder="123456"
            style={{ fontSize: 28, letterSpacing: '0.4em', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700 }} />
          {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
          {notice && <p role="status" style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--green)' }}>{notice}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6} style={{ marginTop: 16, opacity: busy || code.length !== 6 ? 0.6 : 1 }}>
            {busy ? 'Checking…' : 'Verify email'}
          </button>
        </form>
        <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)' }}>
          Didn't get it?{' '}
          <button type="button" onClick={resend} disabled={wait > 0}
            className="btn btn-outline" style={{ minHeight: 38, padding: '0 16px', fontSize: 14, marginLeft: 6 }}>
            {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
          </button>
        </p>
        <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Wrong email?{' '}
          <button type="button" onClick={async () => { await logout(); navigate('/signin?mode=join'); }}
            className="btn btn-outline" style={{ minHeight: 38, padding: '0 16px', fontSize: 14, marginLeft: 6 }}>Sign out and start again</button>
        </p>
      </div>
    </div>
  );
}
