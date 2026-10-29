import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, sceneFor, TAG_LABEL, type ReportReason } from '../api';
import { Avatar } from '../components/Avatar';
import { ShareSheet } from '../components/ShareSheet';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Comments, REASONS } from '../components/Comments';
import { QnA } from '../components/QnA';
import { Reactions } from '../components/Reactions';
import { Empty, Loading } from '../components/States';
import { useApi } from '../useApi';
import { useAuth } from '../auth';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

export function Story() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const [sharing, setSharing] = useState(false);
  // Refetch when the signed-in user changes: the server decides how much of the story to return.
  const { data: trip, error, loading } = useApi(() => api.trip(slug), [slug, user?.id]);

  if (loading && !trip) return <div className="app" style={{ padding: 20 }}><Loading /></div>;
  if (error || !trip) {
    return (
      <div className="app" style={{ padding: 20 }}>
        <Empty title="This story isn't available" body="It may be private, still a draft, or the link is wrong." cta={{ to: '/discover', label: 'Back to Discover' }} />
      </div>
    );
  }

  const next = encodeURIComponent(`/trips/${trip.slug}`);
  const share = trip.locked ? Math.round((trip.sections.length / Math.max(1, trip.totalSections)) * 100) : 100;
  const firstName = trip.author.displayName.split(' ')[0];
  const meta = [trip.kind === 'SHORT' && trip.shortTag ? TAG_LABEL[trip.shortTag] : null, trip.place, dateRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 30, background: 'var(--line)' }}>
        <span style={{ display: 'block', height: '100%', width: `${share}%`, background: 'var(--green)', transition: 'width .6s' }} />
      </div>

      <div style={{ height: '72vh', minHeight: 480, maxHeight: 640, position: 'relative', color: '#fff' }}>
        <Photo scene={sceneFor(trip.id)} src={trip.cover?.url} alt={`Cover photo: ${trip.title}`} />
        <div style={{ position: 'absolute', top: 12, left: 10, right: 10, display: 'flex', justifyContent: 'space-between' }}>
          <Link to="/discover" className="icon-btn solid" aria-label="Back" style={{ color: 'var(--ink)' }}><Icon.back /></Link>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" className="icon-btn solid" aria-label="Share story" style={{ color: 'var(--ink)' }}
              onClick={() => setSharing(true)}><Icon.share /></button>
          </span>
        </div>
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', padding: 22, background: 'linear-gradient(to top, rgba(20,14,10,.75), rgba(20,14,10,0))' }}>
          {trip.status === 'DRAFT' && <span className="tag tag-gold" style={{ marginBottom: 10 }}>Draft · only you can see this</span>}
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase' }}>{meta}</p>
          <h1 className="display rise" style={{ margin: '8px 0 0', fontSize: 'clamp(44px, 8vw, 72px)' }}>{trip.title}</h1>
          <Link to={`/u/${trip.author.username}`} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none' }}>
            <Avatar name={trip.author.displayName} url={trip.author.avatarUrl} size={32} ring="#fff" />
            <span style={{ fontSize: 13 }}>by <strong>{trip.author.username}</strong></span>
          </Link>
        </div>
      </div>

      {trip.owner && <OwnerBar id={trip.id} slug={trip.slug} status={trip.status} visibility={trip.visibility} />}

      {trip.intro && (
        <div style={{ padding: '26px 22px 0' }}>
          <p className="display" style={{ margin: 0, fontSize: 24, lineHeight: 1.25, fontWeight: 500, letterSpacing: '-.01em' }}>{trip.intro}</p>
        </div>
      )}

      {trip.sections.map((s, i) => (
        <section key={i} className="rise">
          <div style={{ padding: '0 22px' }}>
            {trip.kind === 'FULL' && (
              <h2 className="eyebrow" style={{ margin: '30px 0 8px', fontWeight: 600 }}>{NUMERALS[i]}{s.heading ? ` · ${s.heading}` : ''}</h2>
            )}
            {trip.kind === 'SHORT' && <div style={{ height: 22 }} />}
            {trip.kind === 'SHORT' && (
              <div style={{ height: 380, borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 10 }}>
                <Photo scene={sceneFor(trip.id + i + 1)} src={s.photo?.url} alt={s.body} />
              </div>
            )}
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--ink-soft)' }}>{s.body}</p>
          </div>
          {trip.kind === 'FULL' && s.photo && (
            <figure style={{ margin: '22px 0 0' }}>
              <div style={{ height: 'min(70vw, 460px)' }}><Photo scene={sceneFor(trip.id + i + 1)} src={s.photo.url} alt={s.photoCaption ?? s.heading ?? 'Trip photo'} /></div>
              {s.photoCaption && <figcaption style={{ padding: '8px 22px 0', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{s.photoCaption}</figcaption>}
            </figure>
          )}
        </section>
      ))}

      {trip.locked ? (
        <>
          <div style={{ position: 'relative', marginTop: -110, height: 110, background: 'linear-gradient(to bottom, transparent, var(--paper))' }} />
          <div className="rise" style={{ margin: '0 16px', background: '#1C1B18', color: '#FBF8F2', borderRadius: 24, padding: '24px 22px' }}>
            <p className="eyebrow" style={{ color: 'var(--gold)' }}>You've read {share}% of this story</p>
            <p className="display" style={{ margin: '10px 0 0', fontSize: 30 }}>The best part is still to come.</p>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>Join free to finish it, save places to your map and ask {firstName} anything.</p>
            <Link to={`/signin?mode=join&next=${next}`} className="btn btn-block" style={{ marginTop: 18, background: '#FBF8F2', color: '#1C1B18' }}>Join free</Link>
            <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 13, color: '#CFC8BA' }}>
              Already a member? <Link to={`/signin?next=${next}`} style={{ color: '#FBF8F2', fontWeight: 600 }}>Sign in</Link>
            </p>
          </div>
        </>
      ) : (
        <div className="rise" style={{ padding: '30px 22px 0' }}>
          {trip.moments.length > 0 && (
            <>
              <h2 className="eyebrow" style={{ margin: '0 0 12px', fontWeight: 600 }}>Favourite moments</h2>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {trip.moments.map((m, i) => (
                  <li key={i} className="paper-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span className="display" style={{ fontSize: 28, color: 'var(--green)' }}>{i + 1}</span><span style={{ fontSize: 14 }}>{m}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {trip.finalNote && <p className="display" style={{ margin: '28px 0 0', fontSize: 26, textAlign: 'center', fontWeight: 700 }}>"{trip.finalNote}"</p>}
          {trip.status === 'PUBLISHED' && <div style={{ marginTop: 26 }}><Reactions tripId={trip.id} initial={trip.reactions} /></div>}
          {trip.status === 'PUBLISHED' && <QnA tripId={trip.id} isOwner={trip.owner} authorName={trip.author.displayName} />}
          {trip.status === 'PUBLISHED' && <Comments tripId={trip.id} isOwner={trip.owner} />}
          {trip.status === 'PUBLISHED' && user && !trip.owner && <ReportStory tripId={trip.id} />}
        </div>
      )}
      {sharing && <ShareSheet trip={trip} onClose={() => setSharing(false)} />}
    </div>
  );
}

/** Readers can flag a story for the Weyvo team; only admins see reports. */
function ReportStory({ tripId }: { tripId: number }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function send(reason: ReportReason) {
    setError('');
    try {
      await api.reportTrip(tripId, reason);
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <div style={{ marginTop: 30, paddingTop: 14, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
      {done ? (
        <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Thanks for telling us. We'll take a look.</p>
      ) : (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          style={{ border: 0, background: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 600, minHeight: 36 }}>
          {open ? 'Cancel' : 'Report this story'}
        </button>
      )}
      {open && (
        <div role="group" aria-label="Report reason" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6 }}>
          {REASONS.map((r) => (
            <button key={r.value} type="button" className="pill" style={{ minHeight: 34, fontSize: 12 }} onClick={() => send(r.value)}>{r.label}</button>
          ))}
        </div>
      )}
      {error && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

/** Only the author sees this: status, Edit, and Delete with a confirmation step. */
function OwnerBar({ id, slug, status, visibility }: { id: number; slug: string; status: string; visibility: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const label = status === 'DRAFT' ? 'Draft · only you can see it' : visibility === 'PUBLIC' ? 'Published · public' : visibility === 'UNLISTED' ? 'Published · unlisted' : 'Published · private';

  async function remove() {
    try {
      await api.deleteTrip(id);
      navigate(user ? `/u/${user.username}` : '/discover', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <div className="paper-card" style={{ margin: '16px 16px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: '1 1 160px', fontSize: 13, color: 'var(--ink-soft)' }}>{label}</span>
      {!confirming ? (
        <>
          <Link to={`/trips/${slug}/edit`} className="btn btn-primary" style={{ minHeight: 40 }}>Edit</Link>
          <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={() => setConfirming(true)}>Delete</button>
        </>
      ) : (
        <>
          <span style={{ flex: '1 1 100%', fontSize: 14, fontWeight: 600 }}>Delete this story and its photos? This can't be undone.</span>
          <button type="button" className="btn" style={{ minHeight: 40, background: '#B3261E', color: '#fff' }} onClick={remove}>Delete for good</button>
          <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={() => setConfirming(false)}>Keep it</button>
        </>
      )}
      {error && <p role="alert" style={{ flex: '1 1 100%', margin: 0, fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}

function dateRange(start: string | null, end: string | null) {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return start ? fmt(start) : null;
}
