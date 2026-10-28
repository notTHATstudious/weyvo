import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { Reactions } from '../components/Reactions';
import { people, tripBySlug } from '../mocks/data';

/** Share of a public story visible before sign-in. The server will enforce the same cut. */
const FREE_SHARE = 0.6;

export function Story() {
  const { slug } = useParams();
  const { signedIn, signIn } = useAuth();
  const trip = tripBySlug(slug);
  if (!trip) return <Navigate to="/discover" replace />;

  const by = people[trip.by];
  const freeCount = Math.max(1, Math.ceil(trip.sections.length * FREE_SHARE));
  const sections = signedIn ? trip.sections : trip.sections.slice(0, freeCount);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 30, background: 'var(--line)' }}>
        <span style={{ display: 'block', height: '100%', width: signedIn ? '100%' : '60%', background: 'var(--green)', transition: 'width .6s' }} />
      </div>

      <div style={{ height: '72vh', minHeight: 480, maxHeight: 640, position: 'relative', color: '#fff' }}>
        <Photo scene={trip.scene} />
        <div style={{ position: 'absolute', top: 12, left: 10, right: 10, display: 'flex', justifyContent: 'space-between' }}>
          <Link to="/discover" className="icon-btn solid" aria-label="Back" style={{ color: 'var(--ink)' }}><Icon.back /></Link>
          <button type="button" className="icon-btn solid" aria-label="Share" style={{ color: 'var(--ink)' }}><Icon.share /></button>
        </div>
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', padding: 22, background: 'linear-gradient(to top, rgba(20,14,10,.75), rgba(20,14,10,0))' }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase' }}>{trip.issue} · {trip.place} · {trip.days}</p>
          <h1 className="display rise" style={{ margin: '8px 0 0', fontSize: 'clamp(44px, 8vw, 72px)' }}>{trip.title}</h1>
          <Link to={`/u/${by.handle}`} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none' }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: by.color, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{by.initial}</span>
            <span style={{ fontSize: 13 }}>by <strong>{by.name}</strong> · {trip.when}</span>
          </Link>
        </div>
      </div>

      <div style={{ padding: '26px 22px 0' }}>
        <p className="display" style={{ margin: 0, fontSize: 24, lineHeight: 1.25, fontWeight: 500, letterSpacing: '-.01em' }}>{trip.intro}</p>
      </div>

      {sections.map((s, i) => (
        <section key={s.heading} className="rise">
          <div style={{ padding: '0 22px' }}>
            <h2 className="eyebrow" style={{ margin: '30px 0 8px', fontWeight: 600 }}>{['I', 'II', 'III', 'IV', 'V'][i]} · {s.heading}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--ink-soft)' }}>{s.body}</p>
          </div>
          {s.photo && (
            <figure style={{ margin: '22px 0 0' }}>
              <div style={{ height: 320 }}><Photo scene={s.photo.scene} /></div>
              <figcaption style={{ padding: '8px 22px 0', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{s.photo.caption}</figcaption>
            </figure>
          )}
        </section>
      ))}

      {!signedIn ? (
        <>
          <div style={{ position: 'relative', marginTop: -110, height: 110, background: 'linear-gradient(to bottom, transparent, var(--paper))' }} />
          <div className="rise" style={{ margin: '0 16px', background: '#1C1B18', color: '#FBF8F2', borderRadius: 24, padding: '24px 22px' }}>
            <p className="eyebrow" style={{ color: 'var(--gold)' }}>You've read 60% of this story</p>
            <p className="display" style={{ margin: '10px 0 0', fontSize: 30 }}>The best part is still to come.</p>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: '#CFC8BA' }}>Join free to finish it, save places to your map and ask {by.name.split(' ')[0]} anything.</p>
            <button type="button" className="btn btn-block" onClick={signIn} style={{ marginTop: 18, background: '#FBF8F2', color: '#1C1B18', border: 0 }}>Continue with Google</button>
            <button type="button" className="btn btn-block" onClick={signIn} style={{ marginTop: 10, background: 'transparent', color: '#FBF8F2', borderColor: '#5E5A52' }}>Sign up with email</button>
            <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 13, color: '#CFC8BA' }}>
              Already a member? <button type="button" onClick={signIn} style={{ border: 0, background: 'none', color: '#FBF8F2', fontWeight: 600, textDecoration: 'underline', padding: 6 }}>Sign in</button>
            </p>
          </div>
        </>
      ) : (
        <div className="rise" style={{ padding: '30px 22px 0' }}>
          <h2 className="eyebrow" style={{ margin: '0 0 12px', fontWeight: 600 }}>Favourite moments</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trip.moments.map((m, i) => (
              <li key={m} className="paper-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="display" style={{ fontSize: 28, color: 'var(--green)' }}>{i + 1}</span><span style={{ fontSize: 14 }}>{m}</span>
              </li>
            ))}
          </ol>
          <p className="display" style={{ margin: '28px 0 0', fontSize: 26, textAlign: 'center', fontWeight: 700 }}>"{trip.finalNote}"</p>
          <div style={{ marginTop: 26 }}><Reactions been={trip.been} want={trip.want} /></div>
          <h2 className="eyebrow" style={{ margin: '32px 0 12px', fontWeight: 600 }}>Ask the traveller</h2>
          <label htmlFor="ask" className="field-label" style={{ fontWeight: 400, color: 'var(--muted)' }}>Ask {by.name.split(' ')[0]} something</label>
          <input id="ask" className="input" type="text" placeholder="Best month to go?" />
        </div>
      )}
    </div>
  );
}
