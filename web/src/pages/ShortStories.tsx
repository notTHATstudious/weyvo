import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, sceneFor, TAG_LABEL, type ShortTag } from '../api';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { useApi } from '../useApi';
import { friendly } from '../components/States';

const FILTERS: ('ALL' | ShortTag)[] = ['ALL', 'WEEKEND', 'ONE_NIGHT', 'LONG_DRIVE', 'DAY_TRIP'];

/** Full-screen dark viewer. Always dark, regardless of the app theme. */
export function ShortStories() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const feed = useApi(() => api.feed('SHORT'), []);
  const list = useMemo(() => (feed.data ?? []).filter((s) => filter === 'ALL' || s.shortTag === filter), [feed.data, filter]);

  const [si, setSi] = useState(0);
  const [pi, setPi] = useState(0);
  // Local overrides after tapping Want; the server's state comes with each card.
  const [wanted, setWanted] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();

  // Open at the story the reader tapped, once the feed has loaded.
  useEffect(() => {
    const start = params.get('start');
    const idx = list.findIndex((s) => s.slug === start);
    if (idx >= 0) setSi(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data]);

  const card = list.length ? list[si % list.length] : null;
  const detail = useApi(() => (card ? api.trip(card.slug) : Promise.resolve(null)), [card?.slug, user?.id]);
  const story = detail.data && card && detail.data.id === card.id ? detail.data : null;

  const total = story ? story.totalSections : 1;
  const n = Math.max(1, list.length);
  const authorAt = (i: number) => list[((i % n) + n) % n]?.author.username;
  const nextStory = () => { setSi((i) => (i + 1) % n); setPi(0); };
  // The buttons move between people: skip the rest of this person's stories, or go back to the start of the previous person's.
  const nextPerson = () => {
    setSi((i) => {
      for (let step = 1; step < n; step++) if (authorAt(i + step) !== authorAt(i)) return (i + step) % n;
      return (i + 1) % n;
    });
    setPi(0);
  };
  const prevPerson = () => {
    setSi((i) => {
      let j = i;
      for (let step = 1; step < n; step++) if (authorAt(i - step) !== authorAt(i)) { j = i - step; break; }
      if (j === i) return (i - 1 + n) % n;
      while (j - 1 > i - n && authorAt(j - 1) === authorAt(j)) j--;
      return ((j % n) + n) % n;
    });
    setPi(0);
  };
  const nextPhoto = () => (pi < total - 1 ? setPi(pi + 1) : nextStory());
  const prevPhoto = () => pi > 0 && setPi(pi - 1);

  const shell = (children: ReactNode) => (
    <div style={{ position: 'fixed', inset: 0, background: '#0F0E0C', color: '#fff', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', overflow: 'hidden' }}>{children}</div>
    </div>
  );

  if (feed.loading) return shell(<p style={{ padding: 24, opacity: 0.8 }}>Loading short stories…</p>);
  if (feed.error) {
    return shell(
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 16 }}>
        <p className="display" style={{ margin: 0, fontSize: 30 }}>{friendly(feed.error.message).title}</p>
        <p style={{ margin: 0, opacity: 0.85 }}>{friendly(feed.error.message).body}</p>
        <button type="button" className="btn" style={{ background: '#FBF8F2', color: '#1C1B18', alignSelf: 'flex-start' }} onClick={feed.retry}>Try again</button>
        <Link to="/discover" className="btn" style={{ alignSelf: 'flex-start', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.45)' }}>Back to Discover</Link>
      </div>,
    );
  }
  if (!card) {
    return shell(
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 16 }}>
        <p className="display" style={{ margin: 0, fontSize: 34 }}>No short stories yet.</p>
        <p style={{ margin: 0, opacity: 0.85 }}>A weekend, a one-night stay, a long drive. Be the first.</p>
        <Link to="/create?type=short" className="btn" style={{ background: '#FBF8F2', color: '#1C1B18', alignSelf: 'flex-start' }}>Post a short story</Link>
        <Link to="/discover" className="btn" style={{ alignSelf: 'flex-start', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.45)' }}>Back to Discover</Link>
      </div>,
    );
  }

  const hidden = story ? pi >= story.sections.length : false;
  const caption = story && !hidden ? story.sections[pi]?.body : '';
  const isWanted = wanted[card.id] ?? card.reactions.wantByMe;
  const mine = !!user && user.username.toLowerCase() === card.author.username.toLowerCase();
  const next = encodeURIComponent(`/shorts?start=${card.slug}`);

  async function toggleWant() {
    if (!user) return navigate(`/signin?mode=join&next=${next}`);
    const id = card!.id;
    setWanted((w) => ({ ...w, [id]: !isWanted }));
    try {
      await api.react(id, 'want', !isWanted);
    } catch {
      setWanted((w) => ({ ...w, [id]: isWanted }));
    }
  }

  return shell(
    <>
      <div key={card.id + '-' + pi} style={{ position: 'absolute', inset: 0, animation: 'slideUp .5s cubic-bezier(.2,.7,.2,1) both', filter: hidden ? 'blur(14px)' : undefined }}>
        <Photo scene={sceneFor(card.id + pi)} src={hidden ? null : story?.sections[pi]?.photo?.url ?? (pi === 0 ? card.cover?.url : null)} alt={caption ?? ''} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,8,6,.85), rgba(10,8,6,.1) 50%, rgba(10,8,6,.35))' }} />
      </div>

      <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.35)', overflow: 'hidden' }}>
            <span key={card.id + '-' + pi} style={{ display: 'block', height: '100%', background: '#fff', width: i <= pi ? '100%' : 0, animation: i === pi ? 'fill 5s linear both' : undefined }} />
          </span>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 26, left: 14, right: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to={`/u/${card.author.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none', flex: 1, minWidth: 0 }}>
          <Avatar name={card.author.displayName} url={card.author.avatarUrl} size={36} ring="#fff" />
          <span><span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{card.author.username}</span><span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{total} photo{total === 1 ? '' : 's'}</span></span>
        </Link>
        <Link to="/discover" className="icon-btn" aria-label="Close" style={{ color: '#fff' }}><Icon.close /></Link>
      </div>

      <div className="scroll-x" style={{ position: 'absolute', top: 80, left: 14, right: 14 }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setSi(0); setPi(0); }}
            style={{ minHeight: 34, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.35)', background: filter === f ? '#FBF8F2' : 'rgba(0,0,0,.25)', color: filter === f ? '#1C1B18' : '#fff', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {f === 'ALL' ? 'All' : TAG_LABEL[f]}
          </button>
        ))}
      </div>

      <button type="button" onClick={prevPhoto} aria-label="Previous photo" style={{ position: 'absolute', left: 0, top: 130, width: '35%', bottom: 280, border: 0, background: 'transparent' }} />
      <button type="button" onClick={nextPhoto} aria-label="Next photo" style={{ position: 'absolute', right: 72, top: 130, width: '45%', bottom: 280, border: 0, background: 'transparent' }} />

      {hidden && (
        <div style={{ position: 'absolute', left: 24, right: 24, top: '34%', textAlign: 'center' }}>
          <p className="display" style={{ margin: 0, fontSize: 28 }}>{story!.totalSections - story!.sections.length} more photo{story!.totalSections - story!.sections.length === 1 ? '' : 's'} in this story</p>
          <Link to={`/signin?mode=join&next=${next}`} className="btn" style={{ marginTop: 16, background: '#FBF8F2', color: '#1C1B18' }}>Join free to see them</Link>
        </div>
      )}

      <div style={{ position: 'absolute', left: 14, right: 12, bottom: 'calc(22px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
            {card.shortTag && <span className="tag tag-gold">{TAG_LABEL[card.shortTag]}</span>}
            <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.9 }}>{card.place}</span>
            <p className="display" style={{ margin: '10px 0 0', fontSize: 34 }}>{card.title}</p>
            {caption && <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, opacity: 0.92 }}>{caption}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', fontSize: 11 }}>
            {/* No Want to go on your own short story; the count still shows. */}
            {!mine && <button type="button" aria-label="Want to go" aria-pressed={isWanted} onClick={toggleWant}
              style={{ width: 52, height: 52, borderRadius: '50%', border: 0, background: isWanted ? 'var(--gold)' : 'rgba(255,255,255,.18)', color: isWanted ? '#1C1B18' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: isWanted ? 'pop .35s ease-out' : undefined }}>
              <Icon.pin size={24} />
            </button>}
            {mine && <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.pin size={24} /></span>}
            <span>{card.reactions.want - (card.reactions.wantByMe ? 1 : 0) + (isWanted ? 1 : 0)}</span>
            <Link to={`/trips/${card.slug}`} aria-label="Open as a page" style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}><Icon.chat size={24} /></Link>
            <span>Open</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={prevPerson} aria-label="Previous person" style={{ width: 56, height: 56, borderRadius: 18, border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.chevronUp /></button>
          <button type="button" onClick={nextPerson} style={{ flex: 1, height: 56, borderRadius: 18, border: 0, background: '#FBF8F2', color: '#1C1B18', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Next short story <Icon.chevronDown /></button>
        </div>
      </div>
    </>,
  );
}
