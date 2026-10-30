import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, type AdminReport } from '../api';
import { Icon } from '../components/Icons';
import { Empty, Loading } from '../components/States';
import { useApi } from '../useApi';

const KIND_LABEL: Record<AdminReport['kind'], string> = { TRIP: 'Story', COMMENT: 'Comment', QUESTION: 'Question' };
const REASON_LABEL: Record<string, string> = { SPAM: 'Spam', ABUSE: 'Abusive', OFF_TOPIC: 'Off topic', OTHER: 'Something else' };

type Tab = 'overview' | 'reports' | 'users';

/** Admins only (the server enforces it): numbers, reported content and accounts. */
export function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}><Icon.back /></button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Admin</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px 40px' }}>
        <h1 className="display" style={{ margin: '8px 0 12px', fontSize: 38 }}>Dashboard</h1>
        <div role="tablist" aria-label="Admin sections" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['overview', 'Overview'], ['reports', 'Reports'], ['users', 'Users']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} type="button" role="tab" className="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ fontSize: 13 }}>{l}</button>
          ))}
        </div>
        {tab === 'overview' && <Overview onReports={() => setTab('reports')} />}
        {tab === 'reports' && <Reports />}
        {tab === 'users' && <Users />}
      </div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('en-IN');

function Overview({ onReports }: { onReports: () => void }) {
  const [version, setVersion] = useState(0);
  const { data: s, loading, error } = useApi(() => api.adminStats(), [version]);
  const [series, setSeries] = useState<'active' | 'signups' | 'stories'>('active');
  if (loading && !s) return <Loading />;
  if (error || !s) return <Empty title="Not available" body="This page is for the Weyvo team." cta={{ to: '/discover', label: 'Back to Discover' }} />;

  const peak = Math.max(1, ...s.daily.map((d) => d[series]));
  const pct = (r: { cohort: number; returned: number }) => (r.cohort ? `${Math.round((r.returned / r.cohort) * 100)}%` : '–');

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Big label="Total users" value={s.users.total} note="All registered accounts" />
        <Big label="Active today" value={s.active.today} note="Signed in and used Weyvo today" />
        <Big label="New signups" value={s.signups.today} note="Today" />
        <Big label="Published stories" value={s.stories.published} note={`${fmt(s.stories.full)} full · ${fmt(s.stories.shorts)} short`} />
      </div>

      <Section title="Active users">
        <Row items={[['Now', s.active.now, 'last 5 min'], ['Daily', s.active.today, 'DAU'], ['Weekly', s.active.week, 'WAU'], ['Monthly', s.active.month, 'MAU']]} />
      </Section>

      <Section title="Last 30 days">
        <div role="tablist" aria-label="Chart" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([['active', 'Active'], ['signups', 'Signups'], ['stories', 'Stories']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" className="tab" aria-selected={series === k} onClick={() => setSeries(k)} style={{ minHeight: 30, padding: '0 12px', fontSize: 12 }}>{l}</button>
          ))}
        </div>
        <div role="img" aria-label={`${series} per day, last 30 days`} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
          {s.daily.map((d) => (
            <span key={d.day} title={`${d.day}: ${d[series]}`}
              style={{ flex: 1, height: Math.max(2, Math.round((d[series] / peak) * 86)), borderRadius: 2, background: d[series] ? 'var(--green)' : 'var(--line-strong)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>
          <span>{short(s.daily[0]?.day)}</span><span>Peak {fmt(peak)}</span><span>Today</span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>Signups this week {fmt(s.signups.week)} · this month {fmt(s.signups.month)}</p>
      </Section>

      <Section title="Engagement · last 7 days">
        <Row items={[['Stories', s.engagement.storiesPublished], ['Comments', s.engagement.comments], ['Questions', s.engagement.questions], ['Been / Want', s.engagement.reactions]]} />
        <div style={{ height: 8 }} />
        <Row items={[['Saves', s.engagement.saves], ['Follows', s.engagement.follows], ['Shares', s.engagement.shares], ['Drafts', s.stories.drafts, 'all time']]} />
      </Section>

      <Section title="Retention">
        <Row items={s.retention.map((r) => [`Day ${r.days}`, pct(r), `${fmt(r.returned)} of ${fmt(r.cohort)} came back`] as [string, string, string])} />
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>People who joined in a 30-day window and were active again after that many days.</p>
      </Section>

      <Section title="Accounts">
        <Row items={[['Verified', s.users.verified], ['Premium', s.users.premium], ['Suspended', s.users.suspended]]} />
        {s.openReports > 0 && (
          <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={onReports}>
            {s.openReports} reported {s.openReports === 1 ? 'item' : 'items'} to review
          </button>
        )}
      </Section>

      <p style={{ margin: '16px 0 0', fontSize: 11, color: 'var(--muted)' }}>
        Updated {new Date(s.generatedAt).toLocaleTimeString()} · days in India time ·{' '}
        <button type="button" className="btn btn-outline" onClick={() => setVersion((v) => v + 1)} style={{ minHeight: 30, padding: '0 12px', fontSize: 12, marginLeft: 4 }}>Refresh</button>
      </p>
    </>
  );
}

function Big({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="paper-card" style={{ padding: '14px 16px' }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{label}</p>
      <p className="display" style={{ margin: '6px 0 0', fontSize: 34 }}>{fmt(value)}</p>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>{note}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="paper-card" style={{ marginTop: 12, padding: '14px 16px' }}>
      <h2 className="eyebrow" style={{ margin: '0 0 10px', fontWeight: 600 }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ items }: { items: [string, number | string, string?][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 8 }}>
      {items.map(([label, value, note]) => (
        <div key={label}>
          <p className="display" style={{ margin: 0, fontSize: 24 }}>{typeof value === 'number' ? fmt(value) : value}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-soft)' }}>{label}</p>
          {note && <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--muted)' }}>{note}</p>}
        </div>
      ))}
    </div>
  );
}

function short(day?: string) {
  return day ? new Date(day + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}

function Reports() {
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useApi(() => api.adminReports(), [version]);
  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Hide takes it down for everyone but its author. Keep puts it back. Both clear the reports.</p>
      {loading && !data ? <Loading /> : error ? (
        <Empty title="Not available" body="This page is for the Weyvo team." />
      ) : !data?.length ? (
        <Empty title="Nothing to review" body="New reports show up here." />
      ) : (
        data.map((r) => <ReportCard key={`${r.kind}-${r.id}`} r={r} onDone={() => setVersion((v) => v + 1)} />)
      )}
    </>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const { data, loading } = useApi(() => api.adminUsers(query), [query, version]);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username, name or email" aria-label="Search users"
        className="input" style={{ width: '100%' }} />
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
      {loading && !data ? <Loading /> : !data?.length ? (
        <p style={{ margin: '14px 2px 0', fontSize: 14, color: 'var(--ink-soft)' }}>No accounts match.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
          {data.map((u) => (
            <li key={u.username} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/u/${u.username}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>{u.username}</Link>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{u.displayName}</span>
                {u.admin && <span className="tag">Admin</span>}
                {u.premium && <span className="tag tag-gold">Premium</span>}
                {!u.verified && <span className="tag">Unverified</span>}
                {u.status === 'SUSPENDED' && <span className="tag" style={{ background: '#B3261E', color: '#fff' }}>Suspended</span>}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', overflowWrap: 'anywhere' }}>
                {u.email} · joined {new Date(u.joinedAt).toLocaleDateString()} · last seen {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : 'never'} · {u.stories} {u.stories === 1 ? 'story' : 'stories'}
              </p>
              {!u.admin && (
                u.status === 'SUSPENDED'
                  ? <button type="button" className="btn btn-outline" style={{ minHeight: 34, marginTop: 8, fontSize: 13 }} onClick={() => run(() => api.adminRestore(u.username))}>Restore account</button>
                  : <SuspendButton onConfirm={() => run(() => api.adminSuspend(u.username))} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SuspendButton({ onConfirm }: { onConfirm: () => void }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <span style={{ display: 'inline-flex', gap: 6, marginTop: 8 }}>
      <button type="button" className="btn" style={{ minHeight: 34, fontSize: 13, background: '#B3261E', color: '#fff' }} onClick={onConfirm}>Suspend and sign out</button>
      <button type="button" className="btn btn-outline" style={{ minHeight: 34, fontSize: 13 }} onClick={() => setSure(false)}>Cancel</button>
    </span>
  ) : (
    <button type="button" className="btn btn-outline" style={{ minHeight: 34, marginTop: 8, fontSize: 13 }} onClick={() => setSure(true)}>Suspend…</button>
  );
}

function ReportCard({ r, onDone }: { r: AdminReport; onDone: () => void }) {
  const [error, setError] = useState('');
  const [suspending, setSuspending] = useState(false);

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <article className="paper-card" style={{ marginBottom: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="tag tag-gold">{KIND_LABEL[r.kind]}</span>
        {r.hidden && <span className="tag">Hidden now</span>}
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {r.reports} {r.reports === 1 ? 'report' : 'reports'} · {r.reasons.map((x) => REASON_LABEL[x] ?? x).join(', ')} · {new Date(r.lastReportedAt).toLocaleString()}
        </span>
      </div>
      {r.kind !== 'TRIP' && <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.text}</p>}
      {r.kind === 'TRIP' && (
        <>
          <p className="display" style={{ margin: '10px 0 0', fontSize: 22 }}>{r.tripTitle}</p>
          {r.text && <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{r.text}</p>}
        </>
      )}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>
        By <Link to={`/u/${r.author}`}>{r.author}</Link>{r.kind !== 'TRIP' && <> on <Link to={`/trips/${r.tripSlug}`}>{r.tripTitle}</Link></>}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn" style={{ minHeight: 38, background: '#B3261E', color: '#fff' }} onClick={() => run(() => api.adminDecide(r.kind, r.id, 'hide'))}>Hide</button>
        <button type="button" className="btn btn-outline" style={{ minHeight: 38 }} onClick={() => run(() => api.adminDecide(r.kind, r.id, 'keep'))}>Keep</button>
        {!suspending ? (
          <button type="button" className="btn btn-outline" style={{ minHeight: 38 }} onClick={() => setSuspending(true)}>Suspend author…</button>
        ) : (
          <button type="button" className="btn" style={{ minHeight: 38, background: '#1C1B18', color: '#fff' }}
            onClick={() => run(async () => { await api.adminSuspend(r.author); await api.adminDecide(r.kind, r.id, 'hide'); })}>
            Suspend {r.author} and hide
          </button>
        )}
      </div>
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </article>
  );
}
