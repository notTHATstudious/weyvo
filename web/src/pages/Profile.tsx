import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { TravelMap } from '../components/TravelMap';
import { people, shorts, trips } from '../mocks/data';

export function Profile() {
  const { handle = '' } = useParams();
  const [following, setFollowing] = useState(false);
  const person = people[handle];
  if (!person) return <Navigate to="/discover" replace />;

  const issues = trips.filter((t) => t.by === handle).concat(trips.filter((t) => t.by !== handle)).slice(0, 4);
  const stats = [['14', 'countries'], ['37', 'cities'], [following ? '2,419' : '2,418', 'followers'], ['310', 'following']];

  return (
    <div className="app">
      <div className="topbar">
        <span className="eyebrow">@{person.handle}</span>
        <Link to="/settings" className="icon-btn" aria-label="Settings"><Icon.settings /></Link>
      </div>

      <div style={{ padding: '4px 20px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span className="display" style={{ width: 76, height: 76, borderRadius: '50%', background: person.color, color: '#FBF8F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, border: '3px solid var(--card)', flexShrink: 0 }}>{person.initial}</span>
        <div>
          <h1 className="display" style={{ margin: 0, fontSize: 32 }}>{person.name}</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>{person.bio}</p>
        </div>
      </div>

      <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
        <button type="button" className={following ? 'btn btn-outline' : 'btn btn-primary'} onClick={() => setFollowing(!following)} style={{ flex: 1, minHeight: 44 }}>
          {following ? 'Following' : 'Follow'}
        </button>
        <button type="button" className="btn btn-outline" style={{ minHeight: 44, borderColor: 'var(--line-strong)' }}>Share profile</button>
      </div>

      <div style={{ margin: '20px 20px 0' }}><TravelMap /></div>

      <div style={{ margin: '14px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', textAlign: 'center' }}>
        {stats.map(([n, l]) => (
          <div key={l}><p className="display" style={{ margin: 0, fontSize: 28 }}>{n}</p><p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted)' }}>{l}</p></div>
        ))}
      </div>

      <div style={{ margin: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--ink)', paddingBottom: 8 }}>
        <h2 className="display" style={{ margin: 0, fontSize: 26 }}>The issues</h2><span style={{ fontSize: 12, color: 'var(--muted)' }}>{issues.length} full trips</span>
      </div>
      <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {issues.map((t) => (
          <Link key={t.slug} to={`/trips/${t.slug}`} className="lift" style={{ display: 'block', background: 'var(--card)', padding: 6, textDecoration: 'none' }}>
            <div className="cover" style={{ height: 200 }}>
              <Photo scene={t.scene} />
              <div className="cover-overlay" style={{ padding: 10 }}>
                <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase' }}>{t.issue}</span>
                <span className="display" style={{ fontSize: 20 }}>{t.title}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ margin: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--ink)', paddingBottom: 8 }}>
        <h2 className="display" style={{ margin: 0, fontSize: 26 }}>Short stories</h2><Link to="/shorts" style={{ fontSize: 13, fontWeight: 500 }}>See all</Link>
      </div>
      <div className="scroll-x" style={{ gap: 10, padding: '14px 20px 0' }}>
        {shorts.map((s) => (
          <Link key={s.id} to={`/shorts?start=${s.id}`} className="cover" style={{ flex: '0 0 120px', height: 180, borderRadius: 14 }}>
            <Photo scene={s.photos[0].scene} />
            <span className="display" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, fontSize: 15, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>{s.title}</span>
          </Link>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
