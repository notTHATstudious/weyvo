import { useEffect, useMemo, useState, type ReactNode, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, sceneFor, TAG_LABEL, type ShortTag, type TripView } from '../api';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../auth';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { useApi } from '../useApi';
import { friendly } from '../components/States';
import { markShortsSeen } from '../shortsSeen';

const FILTERS: ('ALL' | ShortTag)[] = ['ALL', 'WEEKEND', 'ONE_NIGHT', 'LONG_DRIVE', 'DAY_TRIP'];

/** Full-screen dark viewer. Always dark, regardless of the app theme. */
export function ShortStories() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const feed = useApi(() => api.feed('SHORT'), []);
  const [gone, setGone] = useState<Set<number>>(() => new Set());
  const list = useMemo(() => (feed.data ?? []).filter((s) => !gone.has(s.id) && (filter === 'ALL' || s.shortTag === filter)), [feed.data, filter, gone]);
  // The ⋯ menu on your own story: closed, open, or asking to confirm a delete.
  const [menu, setMenu] = useState<'closed' | 'open' | 'confirm'>('closed');
  const [menuError, setMenuError] = useState('');

  const [si, setSi] = useState(0);
  const [pi, setPi] = useState(0);
  // Local overrides after tapping Want; the server's state comes with each card.
  const [wanted, setWanted] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();

  // Opening Short Stories clears the 'new' dot on the bottom bar.
  useEffect(markShortsSeen, []);

  // Open at the story the reader tapped, once the feed has loaded.
  useEffect(() => {
    const start = params.get('start');
    const idx = list.findIndex((s) => s.slug === start);
    if (idx >= 0) setSi(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data]);

  const card = list.length ? list[si % list.length] : null;
  // Each story's photos and captions, loaded for this story and the ones either side of it ahead of time,
  // so moving on never waits on the network.
  const [details, setDetails] = useState<Record<string, TripView>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    asked.current.clear();
    setDetails({});
  }, [user?.id]);
  useEffect(() => {
    if (!list.length) return;
    const around = [si, si + 1, si + 2, si - 1].map((i) => list[((i % list.length) + list.length) % list.length]);
    for (const c of around) {
      if (!c || asked.current.has(c.slug)) continue;
      asked.current.add(c.slug);
      api.trip(c.slug).then((v) => setDetails((d) => ({ ...d, [c.slug]: v })), () => asked.current.delete(c.slug));
      if (c.cover?.url) new Image().src = c.cover.url;
    }
  }, [si, list]);
  const story = card ? details[card.slug] ?? null : null;

  const total = story ? story.totalSections : 1;
  const n = Math.max(1, list.length);
  const authorAt = (i: number) => list[((i % n) + n) % n]?.author.username;
  useEffect(() => { setMenu('closed'); setMenuError(''); }, [si]);
  const nextStory = () => { setSi((i) => (i + 1) % n); setPi(0); };
  const prevStory = () => { setSi((i) => (i - 1 + n) % n); setPi(0); };
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
  const prevPhoto = () => (pi > 0 ? setPi(pi - 1) : prevStory());

  // Swipe up for the next story, swipe down for the previous one; sideways swipes move between sections
  // (handled app-wide). Closing is the × button only, so a stray pull never throws you out.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !card) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.5 || Date.now() - start.t > 800) return;
    if (dy < 0) nextStory();
    else prevStory();
  };

  // Tap anywhere on the photo: left third goes back a photo, the rest goes forward (then on to the next story).
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!card || (e.target as HTMLElement).closest('a, button, input, label, [role="tab"], [role="menu"]')) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX - box.left < box.width * 0.35) prevPhoto();
    else nextPhoto();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextPhoto();
      else if (e.key === 'ArrowLeft') prevPhoto();
      else if (e.key === 'ArrowDown') nextStory();
      else if (e.key === 'ArrowUp') prevStory();
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const close = () => (location.key !== 'default' ? navigate(-1) : navigate('/discover', { replace: true }));

  const shell = (children: ReactNode) => (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, background: '#0F0E0C', color: '#fff', display: 'flex', justifyContent: 'center', touchAction: 'pan-x', overscrollBehavior: 'none' }}>
      <div onClick={onTap} style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', overflow: 'hidden' }}>{children}</div>
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

  async function removeMine() {
    setMenuError('');
    try {
      await api.deleteTrip(card!.id);
      const id = card!.id;
      setGone((g) => new Set(g).add(id));
      setPi(0);
      setMenu('closed');
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  }

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
        {mine && (
          <button type="button" className="close-btn on-dark" aria-label="Options for your story" aria-expanded={menu !== 'closed'}
            onClick={() => setMenu(menu === 'closed' ? 'open' : 'closed')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
        )}
        <button type="button" className="close-btn on-dark" aria-label="Close stories" onClick={close}><Icon.close /></button>
      </div>

      {mine && menu !== 'closed' && (
        <div role="menu" style={{ position: 'absolute', top: 80, right: 12, zIndex: 5, width: 230, padding: 8, borderRadius: 18,
          background: 'rgba(20,18,15,.92)', border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 12px 30px rgba(0,0,0,.4)' }}>
          {menu === 'open' ? (
            <>
              <Link role="menuitem" to={`/trips/${card.slug}/edit`} state={{ back: true }}
                style={{ display: 'flex', alignItems: 'center', minHeight: 46, padding: '0 14px', borderRadius: 12, color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>Edit story</Link>
              <button type="button" role="menuitem" onClick={() => setMenu('confirm')}
                style={{ width: '100%', minHeight: 46, padding: '0 14px', borderRadius: 12, border: 0, background: 'transparent', color: '#FF8A80', fontSize: 15, fontWeight: 600, textAlign: 'left' }}>Delete story</button>
            </>
          ) : (
            <div style={{ padding: 8 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Delete this story and its photos?</p>
              <p style={{ margin: '4px 0 10px', fontSize: 12, opacity: 0.75 }}>This can't be undone.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={removeMine} style={{ flex: 1, minHeight: 40, borderRadius: 999, border: 0, background: '#B3261E', color: '#fff', fontWeight: 700 }}>Delete</button>
                <button type="button" onClick={() => setMenu('closed')} style={{ flex: 1, minHeight: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.4)', background: 'transparent', color: '#fff', fontWeight: 600 }}>Keep</button>
              </div>
              {menuError && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: '#FF8A80' }}>{menuError}</p>}
            </div>
          )}
        </div>
      )}

      <div className="scroll-x" style={{ position: 'absolute', top: 80, left: 14, right: 14 }}>
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setSi(0); setPi(0); }}
            style={{ minHeight: 34, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.35)', background: filter === f ? '#FBF8F2' : 'rgba(0,0,0,.25)', color: filter === f ? '#1C1B18' : '#fff', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {f === 'ALL' ? 'All' : TAG_LABEL[f]}
          </button>
        ))}
      </div>


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
          <Link to="/create?type=short" aria-label="Post a new short story"
            style={{ width: 56, height: 56, flex: '0 0 56px', borderRadius: 18, background: 'var(--gold)', color: '#1C1B18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.plus size={26} /></Link>
        </div>
      </div>
    </>,
  );
}
