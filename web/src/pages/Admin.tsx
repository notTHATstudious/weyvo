import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, type AdminReport } from '../api';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Empty, Loading } from '../components/States';
import { useApi } from '../useApi';

const KIND_LABEL: Record<AdminReport['kind'], string> = { TRIP: 'Story', COMMENT: 'Comment', QUESTION: 'Question' };
const REASON_LABEL: Record<string, string> = { SPAM: 'Spam', ABUSE: 'Abusive', OFF_TOPIC: 'Off topic', OTHER: 'Something else' };

/** Admins only (the server enforces it): reported stories, comments and questions, newest report first. */
export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useApi(() => api.adminReports(), [version, user?.id]);

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}><Icon.back /></button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Admin</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px 40px' }}>
        <h1 className="display" style={{ margin: '8px 0 6px', fontSize: 38 }}>Reports</h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Hide takes it down for everyone but its author. Keep puts it back. Both clear the reports.</p>
        {loading ? <Loading /> : error ? (
          <Empty title="Not available" body="This page is for the Weyvo team." cta={{ to: '/discover', label: 'Back to Discover' }} />
        ) : !data?.length ? (
          <Empty title="Nothing to review" body="New reports show up here." />
        ) : (
          data.map((r) => <ReportCard key={`${r.kind}-${r.id}`} r={r} onDone={() => setVersion((v) => v + 1)} />)
        )}
      </div>
    </div>
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
