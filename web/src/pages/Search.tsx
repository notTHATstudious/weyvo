import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, sceneFor, type SearchResults } from '../api';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';

/** One box for travellers, destinations and stories. The query lives in the URL, so back keeps it. */
export function Search() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const q = text.trim();

  useEffect(() => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let current = true;
    const t = setTimeout(async () => {
      setParams(q ? { q } : {}, { replace: true });
      setBusy(true);
      try {
        const r = await api.search(q);
        if (current) setResults(r);
      } catch {
        if (current) setResults({ people: [], places: [], stories: [] });
      } finally {
        if (current) setBusy(false);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const empty = results && !results.people.length && !results.places.length && !results.stories.length;

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px', gap: 6 }}>
        <BackButton fallback="/discover" />
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--line-strong)', borderRadius: 999, padding: '0 14px', minHeight: 44 }}>
          <Icon.search />
          <input type="search" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Travellers, places, stories" aria-label="Search"
            enterKeyHint="search" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', color: 'var(--ink)', fontSize: 16 }} />
        </label>
      </div>

      <div style={{ padding: '6px 20px 0' }}>
        {q.length < 2 && <p style={{ margin: '12px 2px', fontSize: 14, color: 'var(--muted)' }}>Search for a traveller, a place like Hampi, or a story.</p>}
        {busy && !results && <p style={{ margin: '12px 2px', fontSize: 14, color: 'var(--muted)' }}>Searching…</p>}
        {empty && <p style={{ margin: '12px 2px', fontSize: 14, color: 'var(--ink-soft)' }}>Nothing found for “{q}”.</p>}

        {!!results?.people.length && (
          <Section title="Travellers">
            {results.people.map((p) => (
              <Link key={p.username} to={`/u/${p.username}`} style={row}>
                <Avatar name={p.displayName} url={p.avatarUrl} size={44} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{p.username}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{p.displayName}</span>
                </span>
              </Link>
            ))}
          </Section>
        )}

        {!!results?.places.length && (
          <Section title="Destinations">
            {results.places.map((p) => (
              <Link key={p.slug} to={`/places/${p.slug}`} style={row}>
                <span aria-hidden="true" style={{ flex: '0 0 44px', height: 44, borderRadius: 12, background: 'var(--chip-gold-bg)', color: 'var(--chip-gold-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.pin /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="display" style={{ display: 'block', fontSize: 19 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{[p.country, p.stories ? `${p.stories} ${p.stories === 1 ? 'story' : 'stories'}` : null].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
            ))}
          </Section>
        )}

        {!!results?.stories.length && (
          <Section title="Stories">
            {results.stories.map((t) => (
              <Link key={t.id} to={`/trips/${t.slug}`} style={row}>
                <span style={{ flex: '0 0 56px', height: 70, borderRadius: 8, overflow: 'hidden' }}><Photo scene={sceneFor(t.id)} src={t.cover?.thumbUrl} /></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t.kind === 'FULL' ? 'Full trip' : 'Short story'} · {t.place}</span>
                  <span className="display" style={{ display: 'block', marginTop: 2, fontSize: 18 }}>{t.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{t.author.username}</span>
                </span>
              </Link>
            ))}
          </Section>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 className="eyebrow" style={{ margin: '0 0 4px', fontWeight: 600 }}>{title}</h2>
      {children}
    </section>
  );
}
