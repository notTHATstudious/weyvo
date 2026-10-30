import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, sceneFor, type TripCard } from '../api';
import { useApi } from '../useApi';
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
      if (mode === 'join') {
        await signup(form);
        navigate(`/verify?next=${encodeURIComponent(next)}`, { replace: true });
      } else {
        await login(form.email, form.password);
        navigate(next, { replace: true });
      }
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
        <Mosaic />
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

          {!joining && (
            <p style={{ margin: '-6px 0 14px', textAlign: 'right' }}>
              <Link to="/forgot" style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', textDecoration: 'none', padding: '6px 0', display: 'inline-block' }}>Forgot password?</Link>
            </p>
          )}
          {error && <p role="alert" style={{ margin: '4px 0 14px', fontSize: 14, color: '#B3261E' }}>{error}</p>}

          {joining && (
            <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--muted)' }}>
              By joining, you agree to the <Link to="/legal/terms">Terms</Link> and <Link to="/legal/privacy">Privacy Policy</Link>, and confirm you're 18 or older.
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 6, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'One moment…' : joining ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)' }}>
          {joining ? 'Already have an account?' : 'New to Weyvo?'}{' '}
          <button type="button" onClick={() => { setMode(joining ? 'signin' : 'join'); setError(''); setFields({}); }}
            className="btn btn-outline" style={{ minHeight: 38, padding: '0 16px', fontSize: 14, marginLeft: 6 }}>
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
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/discover';
}

/**
 * Real places from real travellers above the form, each tagged with where and who. Only covers other
 * readers have reacted to this week make it (the most loved first), so a random or test photo never
 * greets a visitor; the illustrations fill any gaps.
 */
function Mosaic() {
  const { data } = useApi(() => api.thisWeek(), []);
  const picks = (data ?? []).filter((t) => t.cover && t.reactions.been + t.reactions.want > 0).slice(0, 3);
  const scenes = ['road', 'mountain', 'sea'] as const;
  const tiles = [0, 1, 2].map((i) => picks[i] ?? null);
  const label = (t: TripCard) => `${t.place.split(',')[0]} · ${t.author.username}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gridTemplateRows: '1fr 1fr', gap: 6, height: 200, margin: '8px 0 22px' }}>
      {tiles.map((t, i) => (
        <div key={i} className="cover" style={{ gridRow: i === 0 ? 'span 2' : undefined, borderRadius: i === 0 ? '22px 8px 8px 22px' : i === 1 ? '8px 22px 8px 8px' : '8px 8px 22px 8px' }}>
          <Photo scene={t ? sceneFor(t.id) : scenes[i]} src={t?.cover?.thumbUrl} alt={t ? `${t.title}, ${t.place}` : ''} />
          {t && (
            <span style={{ position: 'absolute', left: 8, bottom: 8, maxWidth: 'calc(100% - 16px)', padding: '4px 9px', borderRadius: 999,
              background: 'rgba(20,14,10,.55)', color: '#fff', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label(t)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
