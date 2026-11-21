import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sceneFor, type Stop } from '../api';
import { Icon } from './Icons';
import { Photo } from './Photo';

/**
 * "Places in this issue": a grid of tiles (Candolim, Panjim, Baga…). Tapping one opens its mini story full screen:
 * tap or swipe through its photos, then on to the next place.
 */
export function PlaceTiles({ stops, total, tripId, joinLink }: { stops: Stop[]; total: number; tripId: number; joinLink?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (total === 0) return null;
  const hidden = total - stops.length;

  return (
    <section aria-labelledby="places-title" className="rise" style={{ padding: '34px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 6px 12px' }}>
        <h2 id="places-title" className="display" style={{ margin: 0, fontSize: 26, letterSpacing: '-.01em' }}>Places in this issue</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{total} {total === 1 ? 'stop' : 'stops'}</span>
      </div>
      <div className="place-grid">
        {stops.map((s, i) => (
          <button key={i} type="button" className="place-tile" onClick={() => setOpen(i)} aria-label={`${s.place}, open its story`}>
            <Photo scene={sceneFor(tripId * 7 + i)} src={s.photos[0]?.thumbUrl ?? s.photos[0]?.url} alt="" />
            <span className="place-tile-shade" aria-hidden="true" />
            <span className="place-tile-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="place-tile-text">
              <strong>{s.place.split(',')[0]}</strong>
              {s.photos.length > 1 && <small>{s.photos.length} photos</small>}
            </span>
          </button>
        ))}
        {hidden > 0 && (
          <Link to={joinLink ?? '/signin?mode=join'} className="place-tile place-tile-locked">
            <span style={{ fontSize: 28 }} aria-hidden="true">🔒</span>
            <strong>+{hidden} more {hidden === 1 ? 'place' : 'places'}</strong>
            <small>Join free to see them</small>
          </Link>
        )}
      </div>
      {open !== null && <PlaceViewer stops={stops} start={open} tripId={tripId} onClose={() => setOpen(null)} />}
    </section>
  );
}

function PlaceViewer({ stops, start, tripId, onClose }: { stops: Stop[]; start: number; tripId: number; onClose: () => void }) {
  const [si, setSi] = useState(start);
  const [pi, setPi] = useState(0);
  const stop = stops[si];
  const count = Math.max(1, stop.photos.length);

  const next = () => (pi < count - 1 ? setPi(pi + 1) : si < stops.length - 1 ? (setSi(si + 1), setPi(0)) : onClose());
  const prev = () => (pi > 0 ? setPi(pi - 1) : si > 0 ? (setSi(si - 1), setPi(0)) : undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={stop.place} className="place-viewer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (e.clientX - box.left < box.width * 0.35) prev(); else next();
      }}>
      <div key={`${si}-${pi}`} className="place-viewer-photo">
        <Photo scene={sceneFor(tripId * 7 + si + pi)} src={stop.photos[pi]?.url} alt={stop.place} />
      </div>
      <div className="place-viewer-shade" aria-hidden="true" />
      <div className="place-viewer-bars">
        {Array.from({ length: count }, (_, i) => <span key={i} className={i <= pi ? 'on' : ''} />)}
      </div>
      <div className="place-viewer-top">
        <span className="place-viewer-count">Stop {si + 1} of {stops.length}</span>
        <button type="button" className="close-btn on-dark" aria-label="Close" onClick={onClose}><Icon.close /></button>
      </div>
      <div key={si} className="place-viewer-text">
        <p className="place-viewer-kicker">{String(si + 1).padStart(2, '0')} · {stop.place.split(',').slice(1).join(',').trim() || 'Stop'}</p>
        <h3 className="display">{stop.place.split(',')[0]}</h3>
        {stop.note && <p className="place-viewer-note">{stop.note}</p>}
        {si < stops.length - 1 && <p className="place-viewer-next">Next: {stops[si + 1].place.split(',')[0]} →</p>}
      </div>
    </div>
  );
}
