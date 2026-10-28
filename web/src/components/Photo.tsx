import type { CSSProperties } from 'react';
import type { Scene } from '../mocks/data';

interface Palette { sky: string; sun: string; c1: string; c2: string; c3: string; sx: number; sy: number; sr: number; p1: string; p2: string; p3: string }

const SCENES: Record<Scene, Palette> = {
  mountain: { sky: '#F2D3B3', sun: '#F8F1E4', c1: '#B9846A', c2: '#7A4E3F', c3: '#3E2A24', sx: 285, sy: 95, sr: 34,
    p1: 'M0 190 L70 120 L130 165 L210 80 L290 150 L350 110 L400 140 L400 300 L0 300Z',
    p2: 'M0 230 L90 170 L170 215 L260 160 L340 210 L400 185 L400 300 L0 300Z',
    p3: 'M0 265 Q100 240 200 262 T400 255 L400 300 L0 300Z' },
  sea: { sky: '#BFD8DC', sun: '#FFF4DC', c1: '#4C8C9A', c2: '#2F6573', c3: '#E9D6B5', sx: 120, sy: 120, sr: 30,
    p1: 'M0 170 L400 170 L400 300 L0 300Z',
    p2: 'M0 205 Q50 198 100 205 T200 205 T300 205 T400 205 L400 300 L0 300Z',
    p3: 'M0 262 Q120 236 260 256 T400 246 L400 300 L0 300Z' },
  road: { sky: '#F4C38B', sun: '#FBE7C6', c1: '#8E9A5B', c2: '#3C3A36', c3: '#F7D9A8', sx: 200, sy: 150, sr: 40,
    p1: 'M0 180 Q100 130 200 170 T400 160 L400 300 L0 300Z',
    p2: 'M188 178 L212 178 L340 300 L60 300Z',
    p3: 'M199 186 L201 186 L207 300 L193 300Z' },
  city: { sky: '#2A2F4A', sun: '#F3D9A4', c1: '#4A4F73', c2: '#1A1D30', c3: '#121423', sx: 320, sy: 60, sr: 18,
    p1: 'M0 300 L0 170 L40 170 L40 130 L80 130 L80 190 L120 190 L120 100 L160 100 L160 160 L200 160 L200 120 L240 120 L240 180 L280 180 L280 90 L320 90 L320 150 L360 150 L360 130 L400 130 L400 300Z',
    p2: 'M0 300 L0 230 L60 230 L60 210 L130 210 L130 240 L210 240 L210 205 L270 205 L270 235 L340 235 L340 215 L400 215 L400 300Z',
    p3: 'M0 282 L400 282 L400 300 L0 300Z' },
  desert: { sky: '#F5DCC0', sun: '#FBF1E6', c1: '#E0A36F', c2: '#C97B4A', c3: '#9C5733', sx: 90, sy: 90, sr: 36,
    p1: 'M0 200 Q120 150 230 190 T400 180 L400 300 L0 300Z',
    p2: 'M0 240 Q90 200 200 235 T400 225 L400 300 L0 300Z',
    p3: 'M0 275 Q150 255 400 270 L400 300 L0 300Z' },
  forest: { sky: '#D9E3D1', sun: '#F6F3E8', c1: '#6E8F6A', c2: '#355543', c3: '#1E3328', sx: 300, sy: 85, sr: 28,
    p1: 'M0 200 L20 150 L40 200 L60 140 L80 200 L100 155 L120 200 L140 135 L160 200 L180 150 L200 200 L220 140 L240 200 L260 155 L280 200 L300 135 L320 200 L340 150 L360 200 L380 145 L400 200 L400 300 L0 300Z',
    p2: 'M0 250 L30 180 L60 250 L90 170 L120 250 L150 190 L180 250 L210 175 L240 250 L270 185 L300 250 L330 170 L360 250 L390 185 L400 250 L400 300 L0 300Z',
    p3: 'M0 285 L400 285 L400 300 L0 300Z' },
};

/**
 * A trip photo filling its box. With `src` it shows the uploaded image; without one it draws an
 * illustrated stand-in so stories without photos still look finished.
 */
export function Photo({ scene, src, alt = '', className, style }: { scene: Scene; src?: string | null; alt?: string; className?: string; style?: CSSProperties }) {
  if (src) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={className}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', background: 'var(--line)', ...style }} />;
  }
  const s = SCENES[scene];
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%', background: s.sky, ...style }}>
      <rect width="400" height="300" fill={s.sky} />
      <circle cx={s.sx} cy={s.sy} r={s.sr} fill={s.sun} />
      <path d={s.p1} fill={s.c1} />
      <path d={s.p2} fill={s.c2} />
      <path d={s.p3} fill={s.c3} />
    </svg>
  );
}
