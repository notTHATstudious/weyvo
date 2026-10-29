import { useEffect, useState } from 'react';
import { api, type TripView } from '../api';
import { renderShareCard, shareCardImage, type CardFormat } from '../shareCard';
import { shareLink } from '../share';

/** Share a story as a link, or as an image card for Instagram and WhatsApp (status or chat). */
export function ShareSheet({ trip, onClose }: { trip: TripView; onClose: () => void }) {
  const [format, setFormat] = useState<CardFormat>('story');
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState('');
  const canShareImage = trip.status === 'PUBLISHED';

  useEffect(() => {
    if (!canShareImage) return;
    let url = '';
    let live = true;
    setCard(null);
    renderShareCard(trip, format)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      })
      .catch(() => live && setNote("Couldn't make the image. Share the link instead."));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [trip, format, canShareImage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function shareImage() {
    if (!card) return;
    const result = await shareCardImage(card.blob, trip.slug, trip.title);
    if (result !== 'cancelled') api.recordShare(trip.id, 'IMAGE').catch(() => undefined);
    setNote(result === 'saved' ? 'Image saved. Post it from your photos.' : result === 'shared' ? 'Shared' : '');
  }

  async function copyLink() {
    const result = await shareLink(`/trips/${trip.slug}`, trip.title);
    if (result === 'copied' || result === 'shared') api.recordShare(trip.id, 'LINK').catch(() => undefined);
    setNote(result === 'copied' ? 'Link copied' : result === 'shared' ? 'Shared' : result === 'failed' ? "Couldn't copy the link" : '');
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Share this story" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,14,10,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', background: 'var(--paper)', color: 'var(--ink)', borderRadius: '24px 24px 0 0', padding: '18px 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ margin: 0, fontSize: 26 }}>Share</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        {canShareImage && (
          <>
            <div role="tablist" aria-label="Image size" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {([['story', 'Status · 9:16'], ['square', 'Post · square']] as [CardFormat, string][]).map(([f, l]) => (
                <button key={f} type="button" role="tab" className="tab" aria-selected={format === f} onClick={() => setFormat(f)} style={{ fontSize: 13 }}>{l}</button>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: format === 'story' ? 200 : 280, aspectRatio: format === 'story' ? '9 / 16' : '1 / 1', borderRadius: 14, overflow: 'hidden', background: 'var(--line)', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>
                {card && <img src={card.url} alt={`Share image for ${trip.title}`} style={{ width: '100%', height: '100%', display: 'block' }} />}
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
              For Instagram or WhatsApp status pick 9:16; for chats and posts, square.
            </p>
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={!card} onClick={shareImage}>
              {card ? 'Share image' : 'Making image…'}
            </button>
          </>
        )}
        <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={copyLink}>Share link</button>
        {note && <p role="status" style={{ margin: '10px 0 0', fontSize: 13, textAlign: 'center', color: 'var(--ink-soft)' }}>{note}</p>}
      </div>
    </div>
  );
}
