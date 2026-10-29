import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

/** Profile, password, data export and account deletion for the signed-in user. */
export function AccountSettings() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <Card title="Plan">
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink-soft)' }}>See your limits, or get more room with Premium.</p>
        <Link to="/premium" className="btn btn-primary" style={{ minHeight: 44 }}>View plans</Link>
      </Card>
      <ProfileCard />
      <PasswordCard />
      <Card title="Your data">
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink-soft)' }}>
          Download everything Weyvo holds about you: profile, stories, questions, reactions and follows.
        </p>
        <a href="/api/me/export" download="weyvo-export.json" className="btn btn-outline" style={{ minHeight: 44 }}>Download my data</a>
      </Card>
      <SessionsCard />
      <DeleteCard />
    </>
  );
}

function Card({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className="paper-card" style={{ marginTop: 20, padding: '16px', border: danger ? '1px solid #E8B4AE' : undefined }}>
      <h2 className="display" style={{ margin: '0 0 12px', fontSize: 22, color: danger ? '#B3261E' : undefined }}>{title}</h2>
      {children}
    </section>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setDone('');
    try {
      await action();
      setDone(success);
    } catch (err) {
      setError(err instanceof ApiError ? Object.values(err.fields)[0] ?? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }
  const status = (
    <>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
      {done && <p role="status" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--green)' }}>{done}</p>}
    </>
  );
  return { busy, run, status };
}

function ProfileCard() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const { busy, run, status } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api.updateProfile(name, bio); await refresh(); }, 'Profile saved');
  };

  return (
    <Card title="Profile">
      <form onSubmit={submit}>
        <label htmlFor="pname" className="field-label">Name</label>
        <input id="pname" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} />
        <label htmlFor="pbio" className="field-label">Bio <span>· {bio.length} / 160</span></label>
        <textarea id="pbio" className="input" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Mountains, slow trains and bad selfies." />
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()} style={{ marginTop: 12, minHeight: 44 }}>{busy ? 'Saving…' : 'Save profile'}</button>
        {status}
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const { busy, run, status } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api.changePassword(current, next); setCurrent(''); setNext(''); }, 'Password changed. Other devices are signed out.');
  };

  return (
    <Card title="Password">
      <form onSubmit={submit}>
        <label htmlFor="pcur" className="field-label">Current password</label>
        <input id="pcur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ marginBottom: 12 }} />
        <label htmlFor="pnew" className="field-label">New password <span>· at least 10 characters</span></label>
        <input id="pnew" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={busy || !current || next.length < 10} style={{ marginTop: 12, minHeight: 44 }}>{busy ? 'Saving…' : 'Change password'}</button>
        {status}
      </form>
    </Card>
  );
}

function SessionsCard() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const { busy, run, status } = useAction();
  return (
    <Card title="Devices">
      <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink-soft)' }}>Lost a phone or used a shared computer? Sign out everywhere, including here.</p>
      <button type="button" className="btn btn-outline" style={{ minHeight: 44 }} disabled={busy}
        onClick={() => run(async () => { await api.logoutEverywhere(); await refresh(); navigate('/signin', { replace: true }); }, 'Signed out everywhere')}>
        {busy ? 'Signing out…' : 'Sign out of all devices'}
      </button>
      {status}
    </Card>
  );
}

function DeleteCard() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const { busy, run, status } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => { await api.deleteAccount(password); await refresh(); navigate('/', { replace: true }); }, 'Account deleted');
  };

  return (
    <Card title="Delete account" danger>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink-soft)' }}>
        Permanently deletes your account, stories, photos, questions, reactions and follows. This can't be undone.
        You may want to download your data first.
      </p>
      {!open ? (
        <button type="button" className="btn btn-outline" style={{ minHeight: 44, borderColor: '#B3261E', color: '#B3261E' }} onClick={() => setOpen(true)}>Delete my account</button>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="dpass" className="field-label">Enter your password to confirm</label>
          <input id="dpass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="btn" disabled={busy || !password} style={{ minHeight: 44, background: '#B3261E', color: '#fff' }}>{busy ? 'Deleting…' : 'Delete for good'}</button>
            <button type="button" className="btn btn-outline" style={{ minHeight: 44 }} onClick={() => { setOpen(false); setPassword(''); }}>Cancel</button>
          </div>
          {status}
        </form>
      )}
    </Card>
  );
}
