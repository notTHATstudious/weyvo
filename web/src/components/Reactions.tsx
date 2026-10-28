import { useState } from 'react';
import { Icon } from './Icons';

/** Travel reactions in place of likes. Local state only until the API exists. */
export function Reactions({ been, want, showSave = true }: { been: number; want: number; showSave?: boolean }) {
  const [r, setR] = useState({ been: false, want: false, save: false });
  const toggle = (k: keyof typeof r) => setR((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="pill" aria-pressed={r.been} onClick={() => toggle('been')}>
        Been there · {been + (r.been ? 1 : 0)}
      </button>
      <button type="button" className="pill" aria-pressed={r.want} onClick={() => toggle('want')}>
        Want to go · {want + (r.want ? 1 : 0)}
      </button>
      {showSave && (
        <button type="button" className="pill" aria-pressed={r.save} aria-label={r.save ? 'Saved' : 'Save'}
          onClick={() => toggle('save')} style={{ width: 44, padding: 0, justifyContent: 'center' }}>
          <Icon.bookmark filled={r.save} />
        </button>
      )}
    </div>
  );
}
