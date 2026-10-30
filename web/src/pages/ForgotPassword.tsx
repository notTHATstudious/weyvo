import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { BackButton } from '../components/BackButton';
import { Wordmark } from '../components/Wordmark';

/** Email → code + new password. The first step replies the same whether or not the account exists. */
export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api.forgotPassword(email); setStep('reset'); });
  };
  const reset = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await resetPassword(email, code, password); navigate('/discover', { replace: true }); });
  };

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <BackButton fallback="/signin" label="Back to sign in" />
        <Wordmark size={22} />
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display rise" style={{ margin: '24px 0 0', fontSize: 38 }}>{step === 'email' ? 'Forgot your password?' : 'Set a new password'}</h1>

        {step === 'email' ? (
          <form onSubmit={sendCode} noValidate>
            <p style={{ margin: '10px 0 22px', fontSize: 15, color: 'var(--ink-soft)' }}>Enter your email and we'll send you a code.</p>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
            {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email.includes('@')} style={{ marginTop: 16 }}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={reset} noValidate>
            <p style={{ margin: '10px 0 22px', fontSize: 15, color: 'var(--ink-soft)' }}>
              If <strong>{email}</strong> has an account, we've sent a 6-digit code. It expires in 10 minutes.
            </p>
            <label htmlFor="code" className="field-label">Code</label>
            <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" style={{ marginBottom: 14, letterSpacing: '0.3em' }} />
            <label htmlFor="password" className="field-label">New password <span>· at least 10 characters</span></label>
            <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 14, color: '#B3261E' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6 || password.length < 10} style={{ marginTop: 16 }}>
              {busy ? 'Saving…' : 'Reset password and sign in'}
            </button>
            <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Resetting signs you out on every other device.</p>
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }}
              style={{ display: 'block', margin: '8px auto 0', border: 0, background: 'none', color: 'var(--green)', fontWeight: 600, padding: 8 }}>Use a different email</button>
          </form>
        )}
      </div>
    </div>
  );
}
