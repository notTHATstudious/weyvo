import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, photoProblem } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';

/** Your photo, name and bio on one page, like Instagram's Edit profile. Save in the top bar. */
export function EditProfile() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [busy, setBusy] = useState<'' | 'save' | 'photo'>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [handle, setHandle] = useState(user?.username ?? '');
  const [rule, setRule] = useState<{ canChange: boolean; nextChangeAt: string | null } | null>(null);
  // Live check of the username being typed: null while unchanged or checking.
  const [check, setCheck] = useState<{ name: string; ok: boolean; problem: string | null } | null>(null);
  const wanted = handle.trim();
  const handleChanged = !!user && wanted !== user.username;

  useEffect(() => { if (user) api.usernameStatus().then(setRule, () => setRule(null)); }, [user?.id]);
  useEffect(() => {
    if (!handleChanged) return setCheck(null);
    const t = setTimeout(() => {
      api.usernameStatus(wanted).then((r) => setCheck({ name: wanted, ok: !!r.available, problem: r.problem }), () => setCheck(null));
    }, 400);
    return () => clearTimeout(t);
  }, [wanted, handleChanged]);

  if (loading) return null;
  if (!user) return <Navigate to="/signin?next=/profile/edit" replace />;
  const handleOk = !handleChanged || (check?.name === wanted && check.ok);
  const changed = handleChanged || name.trim() !== user.displayName || (bio.trim() || null) !== (user.bio || null);
  const nextChange = rule?.nextChangeAt ? new Date(rule.nextChangeAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  async function act(kind: 'save' | 'photo', action: () => Promise<void>, done: string) {
    setBusy(kind);
    setError('');
    setNote('');
    try {
      await action();
      setNote(done);
    } catch (err) {
      setError(err instanceof ApiError ? Object.values(err.fields)[0] ?? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy('');
    }
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!name.trim() || busy) return;
    await act('save', async () => {
      let username = user!.username;
      if (handleChanged) username = (await api.changeUsername(wanted)).username;
      await api.updateProfile(name.trim(), bio.trim());
      await refresh();
      navigate(`/u/${username}`, { replace: true });
    }, '');
  }

  const photoInput = (
    <input type="file" accept="image/jpeg,image/png" disabled={!!busy} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const problem = photoProblem(f);
        if (problem) return setError(problem);
        act('photo', async () => { await api.uploadAvatar(f); await refresh(); }, 'Photo updated');
      }} />
  );
  const ready = changed && !!name.trim() && handleOk && !busy;

  return (
    <div className="app" style={{ paddingBottom: 40 }}>
      {/* Green cover band with the top bar on it, and the photo sitting across its lower edge. */}
      <div style={{ position: 'relative', height: 150, background: 'linear-gradient(160deg, #2B6A50 0%, var(--green) 55%, #163A2B 100%)', color: '#FBF8F2' }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 85% 10%, rgba(227,162,59,.35), transparent 45%)' }} />
        <div className="topbar" style={{ position: 'relative', padding: '12px 10px 4px', color: 'inherit' }}>
          <BackButton fallback={`/u/${user.username}`} style={{ color: '#FBF8F2' }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Edit profile</span>
          <button type="button" onClick={() => save()} disabled={!ready}
            style={{ minWidth: 60, minHeight: 36, padding: '0 14px', borderRadius: 999, border: 0, fontSize: 14, fontWeight: 700,
              background: ready ? 'var(--gold)' : 'rgba(255,255,255,.15)', color: ready ? '#1C1B18' : 'rgba(251,248,242,.6)', transition: 'background .2s' }}>
            {busy === 'save' ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: -56, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <label aria-label={user.avatarUrl ? 'Change photo' : 'Add photo'} style={{ position: 'relative', cursor: busy ? 'default' : 'pointer', borderRadius: '50%' }}>
          <span style={{ display: 'block', borderRadius: '50%', boxShadow: '0 10px 30px rgba(0,0,0,.18)', opacity: busy === 'photo' ? 0.6 : 1 }}>
            <Avatar name={name || user.displayName} url={user.avatarUrl} size={112} ring="var(--paper)" />
          </span>
          <span aria-hidden="true" style={{ position: 'absolute', right: 2, bottom: 4, width: 36, height: 36, borderRadius: '50%', background: 'var(--gold)', color: '#1C1B18',
            border: '3px solid var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
          {photoInput}
        </label>
        <p className="display" style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 700 }}>{name.trim() || user.displayName}</p>
        <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--muted)' }}>@{user.username}</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <label className="pill" style={{ minHeight: 34, fontSize: 13, cursor: busy ? 'default' : 'pointer', position: 'relative' }}>
            {busy === 'photo' ? 'Saving…' : user.avatarUrl ? 'Change photo' : 'Add photo'}
            {photoInput}
          </label>
          {user.avatarUrl && (
            <button type="button" className="pill" disabled={!!busy} style={{ minHeight: 34, fontSize: 13, color: 'var(--muted)' }}
              onClick={() => act('photo', async () => { await api.removeAvatar(); await refresh(); }, 'Photo removed')}>Remove</button>
          )}
        </div>
      </div>

      <form onSubmit={save} style={{ padding: '22px 20px 0' }}>
        <div className="paper-card" style={{ padding: 0, overflow: 'hidden' }}>
          <Row id="pname" label="Name">
            <input id="pname" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={FIELD} />
          </Row>
          <Row id="puser" label="Username" hint={rule?.canChange === false && nextChange ? `Can change on ${nextChange}` : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 16, color: 'var(--muted)' }}>@</span>
              <input id="puser" value={handle} readOnly={rule?.canChange === false} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(e) => setHandle(e.target.value.replace(/\s/g, ''))}
                style={{ ...FIELD, color: rule?.canChange === false ? 'var(--muted)' : 'var(--ink)' }} />
            </div>
            {handleChanged && (
              <p role="status" style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600,
                color: check?.name !== wanted ? 'var(--muted)' : check.ok ? 'var(--green)' : '#B3261E' }}>
                {check?.name !== wanted ? 'Checking…' : check.ok ? '✓ Available' : check.problem}
              </p>
            )}
            {handleChanged && check?.ok && check.name === wanted && (
              <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
                After this you can change it again in 3 months. Old links to your profile will stop working.
              </p>
            )}
          </Row>
          <Row id="pbio" label="Bio" hint={`${bio.length} / 160`} last>
            <textarea id="pbio" rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="Mountains, slow trains and bad selfies." style={{ ...FIELD, resize: 'none', lineHeight: 1.45 }} />
          </Row>
        </div>

        {error && <p role="alert" style={{ margin: '12px 4px 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
        {note && <p role="status" style={{ margin: '12px 4px 0', fontSize: 13, color: 'var(--green)' }}>{note}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!ready}
          style={{ marginTop: 20, opacity: ready ? 1 : 0.45, transition: 'opacity .2s' }}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}

const FIELD = { width: '100%', border: 0, outline: 'none', background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 16, padding: '2px 0 0' } as const;

/** One field inside the grouped card: small label on top, a line between rows, the label turns green while you type. */
function Row({ id, label, hint, last, children }: { id: string; label: string; hint?: string; last?: boolean; children: ReactNode }) {
  return (
    <div className="edit-row" style={{ padding: '12px 16px', borderBottom: last ? 0 : '1px solid var(--line)' }}>
      <label htmlFor={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: 'var(--muted)' }}>
        <span>{label}</span>{hint && <span style={{ fontWeight: 500 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}
