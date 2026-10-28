import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icons';
import { Photo } from '../components/Photo';
import { people, shorts, type ShortTag } from '../mocks/data';

const FILTERS: ('All' | ShortTag)[] = ['All', 'Weekend', 'One night', 'Long drive', 'Day trip'];

/** Full-screen dark viewer. Always dark, regardless of the app theme. */
export function ShortStories() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const list = shorts.filter((s) => filter === 'All' || s.tag === filter);
  const startIdx = Math.max(0, list.findIndex((s) => s.id === params.get('start')));
  const [si, setSi] = useState(startIdx);
  const [pi, setPi] = useState(0);
  const [wanted, setWanted] = useState<Record<string, boolean>>({});

  const story = list[si % list.length];
  const photo = story.photos[Math.min(pi, story.photos.length - 1)];
  const by = people[story.by];
  const isWanted = !!wanted[story.id];

  const nextStory = () => { setSi((i) => (i + 1) % list.length); setPi(0); };
  const prevStory = () => { setSi((i) => (i - 1 + list.length) % list.length); setPi(0); };
  const nextPhoto = () => (pi < story.photos.length - 1 ? setPi(pi + 1) : nextStory());
  const prevPhoto = () => pi > 0 && setPi(pi - 1);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0F0E0C', color: '#fff', display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', overflow: 'hidden' }}>
        <div key={story.id + pi} style={{ position: 'absolute', inset: 0, animation: 'slideUp .5s cubic-bezier(.2,.7,.2,1) both' }}>
          <Photo scene={photo.scene} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,8,6,.85), rgba(10,8,6,.1) 50%, rgba(10,8,6,.35))' }} />
        </div>

        <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', gap: 4 }}>
          {story.photos.map((_, i) => (
            <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.35)', overflow: 'hidden' }}>
              <span key={story.id + pi} style={{ display: 'block', height: '100%', background: '#fff', width: i <= pi ? '100%' : 0, animation: i === pi ? 'fill 5s linear both' : undefined }} />
            </span>
          ))}
        </div>

        <div style={{ position: 'absolute', top: 26, left: 14, right: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to={`/u/${by.handle}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', textDecoration: 'none', flex: 1, minWidth: 0 }}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: by.color, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{by.initial}</span>
            <span><span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{by.name}</span><span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{story.when} · {story.photos.length} photos</span></span>
          </Link>
          <Link to="/discover" className="icon-btn" aria-label="Close" style={{ color: '#fff' }}><Icon.close /></Link>
        </div>

        <div className="scroll-x" style={{ position: 'absolute', top: 80, left: 14, right: 14 }}>
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => { setFilter(f); setSi(0); setPi(0); }}
              style={{ minHeight: 34, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.35)', background: filter === f ? '#FBF8F2' : 'rgba(0,0,0,.25)', color: filter === f ? '#1C1B18' : '#fff', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
              {f}
            </button>
          ))}
        </div>

        <button type="button" onClick={prevPhoto} aria-label="Previous photo" style={{ position: 'absolute', left: 0, top: 130, width: '35%', bottom: 280, border: 0, background: 'transparent' }} />
        <button type="button" onClick={nextPhoto} aria-label="Next photo" style={{ position: 'absolute', right: 72, top: 130, width: '45%', bottom: 280, border: 0, background: 'transparent' }} />

        <div style={{ position: 'absolute', left: 14, right: 12, bottom: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
          <span className="tag tag-gold">{story.tag}</span>
          <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.9 }}>{story.place}</span>
          <p className="display" style={{ margin: '10px 0 0', fontSize: 34 }}>{story.title}</p>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, opacity: 0.92 }}>{photo.caption}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', fontSize: 11 }}>
          <button type="button" aria-label="Want to go" aria-pressed={isWanted} onClick={() => setWanted((w) => ({ ...w, [story.id]: !isWanted }))}
            style={{ width: 52, height: 52, borderRadius: '50%', border: 0, background: isWanted ? 'var(--gold)' : 'rgba(255,255,255,.18)', color: isWanted ? '#1C1B18' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: isWanted ? 'pop .35s ease-out' : undefined }}>
            <Icon.pin size={24} />
          </button>
          <span>{story.want + (isWanted ? 1 : 0)}</span>
          <button type="button" aria-label="Been there" style={{ width: 52, height: 52, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}><Icon.check size={24} /></button>
          <span>{story.been}</span>
          <button type="button" aria-label="Ask the traveller" style={{ width: 52, height: 52, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}><Icon.chat size={24} /></button>
          <span>Ask</span>
        </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={prevStory} aria-label="Previous short story" style={{ width: 56, height: 56, borderRadius: 18, border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.chevronUp /></button>
          <button type="button" onClick={nextStory} style={{ flex: 1, height: 56, borderRadius: 18, border: 0, background: '#FBF8F2', color: '#1C1B18', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Next short story <Icon.chevronDown /></button>
        </div>
        </div>
      </div>
    </div>
  );
}
