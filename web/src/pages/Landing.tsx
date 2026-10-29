import { Link } from 'react-router-dom';
import { Photo } from '../components/Photo';
import { Icon } from '../components/Icons';
import { Footer } from '../components/Footer';
import { people, shorts, trips } from '../mocks/data';

const pillars = [
  { n: '01', t: 'Full trips', d: 'A guided magazine template: cover, photos, story sections and favourite moments. No blank page.' },
  { n: '02', t: 'Short stories', d: 'Weekends, one-night stays, long drives. A few photos and a line or two, posted in a minute.' },
  { n: '03', t: 'Your travel map', d: 'Every story pins a place. Your profile becomes a living archive of everywhere you have been.' },
];

export function Landing() {
  const hero = trips[0];
  const issue = trips.slice(1, 4);

  return (
    <div>
      <header className="app-wide" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
          <span className="display" style={{ fontSize: 26 }}>weyvo<span style={{ color: 'var(--gold)' }}>.</span></span>
        </Link>
        <nav aria-label="Main" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, fontSize: 14 }}>
          <Link to="/discover" style={{ color: 'var(--ink)', textDecoration: 'none' }}>Discover</Link>
          <Link to="/shorts" style={{ color: 'var(--ink)', textDecoration: 'none' }}>Short Stories</Link>
          <Link to="/places" style={{ color: 'var(--ink)', textDecoration: 'none' }}>Destinations</Link>
          <Link to="/create" className="btn btn-primary" style={{ minHeight: 44 }}>Start your magazine</Link>
        </nav>
      </header>

      <section className="app-wide" style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', padding: '64px 24px 56px' }}>
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <p className="eyebrow rise">Issue 01 · For people who travel and remember</p>
          <h1 className="display rise" style={{ margin: '18px 0 0', fontSize: 'clamp(52px, 7.5vw, 104px)' }}>
            Every journey deserves <span style={{ color: 'var(--green)' }}>its own story.</span>
          </h1>
          <p className="rise" style={{ margin: '24px 0 0', fontSize: 18, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: '30em' }}>
            Turn your photos and memories into a beautiful trip magazine, from a two-week trek to a Sunday long drive. Your profile becomes a shelf of every place you've been.
          </p>
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link to="/create" className="btn btn-primary">Create your first issue</Link>
            <Link to="/discover" className="btn btn-outline">Read stories</Link>
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 13, color: 'var(--muted)' }}>Free to start · No app to install</p>
        </div>

        <div style={{ flex: '1 1 400px', minWidth: 0, position: 'relative', height: 540 }}>
          <Link to="/discover" className="cover lift rise" style={{ position: 'absolute', right: 20, top: 0, width: 'min(330px, 85%)', height: 460, background: 'var(--card)', padding: 12, boxShadow: 'var(--shadow)' }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
              <Photo scene={hero.scene} />
              <div className="cover-overlay">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}><span>Weyvo</span><span>{hero.issue}</span></div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase' }}>{hero.place}</p>
                  <p className="display" style={{ margin: '6px 0 0', fontSize: 40 }}>{hero.title}</p>
                  <p style={{ margin: '10px 0 0', fontSize: 12 }}>by {people[hero.by].name}</p>
                </div>
              </div>
            </div>
          </Link>
          <Link to="/shorts" className="lift" style={{ position: 'absolute', left: 0, bottom: 0, width: 200, background: '#fff', padding: '10px 10px 14px', boxShadow: 'var(--shadow)', transform: 'rotate(-5deg)', textDecoration: 'none' }}>
            <div style={{ height: 170 }}><Photo scene="road" /></div>
            <p className="display" style={{ margin: '10px 2px 0', fontSize: 19, color: '#1C1B18' }}>Sunday drive to Lonavala</p>
            <p style={{ margin: '8px 2px 0', fontSize: 11 }}><span className="tag" style={{ background: '#F1E3C4', color: '#6B4A12' }}>Long drive</span></p>
          </Link>
          <div style={{ position: 'absolute', right: 0, bottom: 30, background: '#1C1B18', color: '#FBF8F2', padding: '14px 16px', borderRadius: 14, display: 'flex', gap: 10, alignItems: 'center', boxShadow: 'var(--shadow)' }}>
            <span style={{ color: 'var(--gold)' }}><Icon.pin /></span>
            <div><p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>214 people</p><p style={{ margin: '2px 0 0', fontSize: 12, color: '#CFC8BA' }}>tapped "Want to go"</p></div>
          </div>
        </div>
      </section>

      <section aria-label="What you can make" style={{ background: '#1C1B18', color: '#FBF8F2' }}>
        <div className="app-wide" style={{ padding: '44px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {pillars.map((p) => (
            <div key={p.n} style={{ display: 'flex', gap: 16 }}>
              <span className="display" style={{ fontSize: 36, color: 'var(--gold)' }}>{p.n}</span>
              <div><p className="display" style={{ margin: 0, fontSize: 24 }}>{p.t}</p><p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: '#CFC8BA' }}>{p.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-wide" style={{ padding: '72px 24px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, borderBottom: '1px solid var(--ink)', paddingBottom: 14 }}>
          <div><p className="eyebrow">This week's Issue · No. 43</p><h2 className="display" style={{ margin: '8px 0 0', fontSize: 48 }}>Monsoon getaways</h2></div>
          <Link to="/discover" style={{ fontSize: 14, fontWeight: 500 }}>Read the full issue →</Link>
        </div>
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
          {issue.map((t) => (
            <Link key={t.slug} to="/discover" className="lift" style={{ textDecoration: 'none', color: 'var(--ink)', background: 'var(--card)', padding: '12px 12px 18px', display: 'block' }}>
              <div style={{ height: 300 }}><Photo scene={t.scene} /></div>
              <p className="eyebrow" style={{ margin: '14px 4px 0' }}>{t.place}</p>
              <p className="display" style={{ margin: '6px 4px 0', fontSize: 26 }}>{t.title}</p>
              <p style={{ margin: '10px 4px 0', fontSize: 13, color: 'var(--muted)' }}>by {people[t.by].name} · {t.days}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="app-wide" style={{ padding: '64px 24px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div><p className="eyebrow">Short Stories</p><h2 className="display" style={{ margin: '8px 0 0', fontSize: 48 }}>Not every trip needs ten days.</h2></div>
          <Link to="/shorts" style={{ fontSize: 14, fontWeight: 500 }}>Watch short stories →</Link>
        </div>
        <div className="scroll-x" style={{ marginTop: 28, gap: 18, paddingBottom: 12 }}>
          {shorts.map((s) => (
            <Link key={s.id} to="/shorts" className="cover lift" style={{ flex: '0 0 210px', height: 340, borderRadius: 18 }}>
              <Photo scene={s.photos[0].scene} />
              <div className="cover-overlay" style={{ padding: 14 }}>
                <span className="tag" style={{ alignSelf: 'flex-start' }}>{s.tag}</span>
                <div><p className="display" style={{ margin: 0, fontSize: 22 }}>{s.title}</p><p style={{ margin: '6px 0 0', fontSize: 12 }}>{people[s.by].name}</p></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--green)', color: 'var(--on-green)', marginTop: 56 }}>
        <div className="app-wide" style={{ padding: '80px 24px', textAlign: 'center' }}>
          <h2 className="display" style={{ margin: '0 auto', maxWidth: '13em', fontSize: 'clamp(40px, 6vw, 72px)' }}>Your next trip is already a story. Give it a cover.</h2>
          <Link to="/create" className="btn btn-light" style={{ marginTop: 32 }}>Start your magazine, free</Link>
        </div>
      </section>

      <div className="app-wide"><Footer /></div>
    </div>
  );
}
