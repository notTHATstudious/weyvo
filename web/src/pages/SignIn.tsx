import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';

/** Sign in and join on one page. ?mode=join opens the join form; ?next= returns the reader where they were. */
export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'signin' | 'join'>(params.get('mode') === 'join' ? 'join' : 'signin');
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' });
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const next = safeNext(params.get('next'));
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFields((f) => ({ ...f, [k]: '' }));
    setError('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      if (mode === 'join') await signup(form);
      else await login(form.email, form.password);
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const joining = mode === 'join';

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to={next} className="icon-btn" aria-label="Back"><Icon.back /></Link>
        <span className="display" style={{ fontSize: 22 }}>weyvo<span style={{ color: 'var(--gold)' }}>.</span></span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ padding: '0 20px' }}>
        <div className="cover" style={{ height: 150, borderRadius: 'var(--radius-lg)', margin: '8px 0 22px' }}>
          <Photo scene="road" />
        </div>
        <h1 className="display rise" style={{ margin: 0, fontSize: 38 }}>{joining ? 'Start your magazine' : 'Welcome back'}</h1>
        <p style={{ margin: '8px 0 22px', fontSize: 15, color: 'var(--ink-soft)' }}>
          {joining ? 'Free, and it takes a minute. Use the email you actually read.' : 'Sign in to finish stories and post your own.'}
        </p>

        <form onSubmit={submit} noValidate>
          {joining && (
            <>
              <Field id="displayName" label="Your name" value={form.displayName} onChange={set('displayName')} error={fields.displayName} autoComplete="name" placeholder="Aarav Mehta" />
              <Field id="username" label="Username" value={form.username} onChange={set('username')} error={fields.username} autoComplete="username" placeholder="aarav.on.roads" />
            </>
          )}
          <Field id="email" label="Email" type="email" value={form.email} onChange={set('email')} error={fields.email} autoComplete="email" placeholder="you@gmail.com" />
          <Field id="password" label="Password" type="password" value={form.password} onChange={set('password')} error={fields.password}
            autoComplete={joining ? 'new-password' : 'current-password'} hint={joining ? 'At least 10 characters' : undefined} />

          {error && <p role="alert" style={{ margin: '4px 0 14px', fontSize: 14, color: '#B3261E' }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 6, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'One moment…' : joining ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)' }}>
          {joining ? 'Already have an account?' : 'New to Weyvo?'}{' '}
          <button type="button" onClick={() => { setMode(joining ? 'signin' : 'join'); setError(''); setFields({}); }}
            style={{ border: 0, background: 'none', color: 'var(--green)', fontWeight: 600, padding: 8, textDecoration: 'underline' }}>
            {joining ? 'Sign in' : 'Join free'}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field(props: {
  id: string; label: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string; type?: string; autoComplete?: string; placeholder?: string; hint?: string;
}) {
  const { id, label, error, hint, ...input } = props;
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} className="field-label">{label}{hint && <span> · {hint}</span>}</label>
      <input id={id} name={id} className="input" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        style={error ? { borderColor: '#B3261E' } : undefined} {...input} />
      {error && <p id={`${id}-err`} style={{ margin: '6px 2px 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

/** Only allow in-app return paths, never an external URL. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/discover';
}
