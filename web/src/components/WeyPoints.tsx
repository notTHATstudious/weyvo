import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../useApi';

const EARN: [string, string][] = [
  ['+5', 'each day you open Weyvo'],
  ['+20', 'for every short story'],
  ['+50', 'for every full issue'],
  ['+50', 'bonus in a week with 4 stories'],
];

/** Your Wey points on your own profile: a gold card with the balance, what it's worth, and how to earn more. */
export function WeyPointsCard() {
  const { data } = useApi(() => api.myPoints(), []);
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const toNext = data.blockPoints - (data.balance % data.blockPoints);
  const progress = ((data.balance % data.blockPoints) / data.blockPoints) * 100;
  const unlocks = new Date(data.unlocksAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section aria-labelledby="wey-title" style={{ margin: '18px 20px 0', borderRadius: 24, padding: '20px 20px 16px', position: 'relative', overflow: 'hidden',
      color: '#2A1E06', background: 'linear-gradient(135deg, #F7D58A 0%, #E3A23B 45%, #B97A1E 100%)',
      boxShadow: '0 10px 30px rgba(185,122,30,.35), inset 0 1px 0 rgba(255,255,255,.5)' }}>
      {/* soft shine across the card */}
      <span aria-hidden="true" style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,.45), transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
        <h2 id="wey-title" style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase' }}>Wey points</h2>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(42,30,6,.12)' }}>
          {data.unlocked ? 'Ready to use' : `Unlocks ${unlocks}`}
        </span>
      </div>

      <p className="display" style={{ margin: '10px 0 0', fontSize: 48, lineHeight: 1, fontWeight: 800, letterSpacing: '-.02em', position: 'relative' }}>
        {data.balance.toLocaleString('en-IN')}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, position: 'relative' }}>
        {data.unlocked
          ? data.redeemableRupees > 0 ? `Worth ₹${data.redeemableRupees} off Premium` : `${toNext} more for ₹${data.blockRupees} off Premium`
          : `Keep earning. After 3 months on Weyvo, every ${data.blockPoints} points takes ₹${data.blockRupees} off Premium.`}
      </p>

      <div style={{ marginTop: 14, position: 'relative' }}>
        <div role="progressbar" aria-label={`Points towards the next ₹${data.blockRupees}`} aria-valuemin={0} aria-valuemax={data.blockPoints}
          aria-valuenow={data.balance % data.blockPoints}
          style={{ height: 8, borderRadius: 999, background: 'rgba(42,30,6,.15)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: '#2A1E06' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
          <span>{toNext} to next ₹{data.blockRupees}</span>
          <span>This week {data.thisWeek} / {data.weekCap}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14, position: 'relative' }}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          style={{ flex: 1, minHeight: 40, borderRadius: 999, border: '1px solid rgba(42,30,6,.35)', background: 'transparent', color: 'inherit', fontSize: 13, fontWeight: 700 }}>
          {open ? 'Hide' : 'How to earn'}
        </button>
        {data.unlocked && data.redeemableRupees > 0 && (
          <Link to="/premium" style={{ flex: 1, minHeight: 40, borderRadius: 999, background: '#2A1E06', color: '#F7D58A', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Use on Premium</Link>
        )}
      </div>

      {open && (
        <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: '12px 0 0', borderTop: '1px solid rgba(42,30,6,.2)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EARN.map(([pts, what]) => (
            <li key={what} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 14 }}>
              <strong className="display" style={{ minWidth: 40, fontSize: 18 }}>{pts}</strong><span>{what}</span>
            </li>
          ))}
          <li style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.85, marginTop: 4 }}>
            Up to 50 a day and {data.weekCap} a week. Points from a story go if it's deleted or removed.
            Use them after 3 months on Weyvo: {data.blockPoints} points = ₹{data.blockRupees} off, up to half the price.
          </li>
        </ul>
      )}
    </section>
  );
}
