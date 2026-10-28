import { useState } from 'react';
import { mapPins } from '../mocks/data';

/** Stylised world map with "been" and "want to go" layers. Real geo data comes with the places API. */
export function TravelMap({ height = 230 }: { height?: number }) {
  const [layer, setLayer] = useState<'been' | 'want'>('been');
  const pins = mapPins[layer];
  const color = layer === 'been' ? 'var(--green)' : '#C77A12';

  return (
    <div style={{ position: 'relative', height, borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--line)' }}>
      <svg viewBox="0 0 350 230" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <g fill="var(--line-strong)">
          <path d="M20 60 Q60 30 110 45 Q140 65 125 95 Q95 115 75 108 Q45 100 35 85Z" />
          <path d="M88 125 Q115 118 125 145 Q128 180 108 210 Q95 195 90 170Z" />
          <path d="M160 45 Q195 32 222 45 Q228 66 208 80 Q180 83 167 70Z" />
          <path d="M168 95 Q202 88 215 113 Q215 153 192 180 Q172 153 166 123Z" />
          <path d="M228 40 Q282 26 322 53 Q330 87 302 107 Q268 113 245 93 Q232 73 228 40Z" />
          <path d="M282 153 Q308 147 322 163 Q315 183 292 180Z" />
        </g>
      </svg>
      {pins.map((p, i) => (
        <span key={layer + p.name} title={p.name}
          style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: 12, height: 12, borderRadius: '50%', background: color,
            border: '2px solid var(--card)', boxShadow: '0 2px 6px rgba(0,0,0,.2)', animation: `pinDrop .6s ${i * 0.08}s cubic-bezier(.3,.8,.3,1.2) both` }} />
      ))}
      <div role="tablist" aria-label="Map layer" style={{ position: 'absolute', left: 10, top: 10, display: 'flex', gap: 4, background: 'var(--card)', borderRadius: 999, padding: 4 }}>
        {(['been', 'want'] as const).map((l) => (
          <button key={l} type="button" role="tab" aria-selected={layer === l} onClick={() => setLayer(l)} className="tab"
            style={{ minHeight: 32, padding: '0 12px', fontSize: 12, border: 0 }}>
            {l === 'been' ? `Been · ${mapPins.been.length}` : `Want to go · ${mapPins.want.length}`}
          </button>
        ))}
      </div>
    </div>
  );
}
