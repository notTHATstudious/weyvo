import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, type Reactions as Counts, type ReactionType } from '../api';
import { useAuth } from '../auth';
import { Icon } from './Icons';

const FIELD: Record<ReactionType, 'beenByMe' | 'wantByMe' | 'savedByMe'> = { been: 'beenByMe', want: 'wantByMe', save: 'savedByMe' };

/** Travel reactions in place of likes. Updates instantly and rolls back if the server refuses. */
export function Reactions({ tripId, initial, author, showSave = true }: { tripId: number; initial: Counts; author: string; showSave?: boolean }) {
  const { signedIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [r, setR] = useState(initial);
  const [busy, setBusy] = useState<ReactionType | null>(null);

  async function toggle(type: ReactionType) {
    if (!signedIn) {
      navigate(`/signin?mode=join&next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const before = r;
    const on = !r[FIELD[type]];
    setR(optimistic(r, type, on));
    setBusy(type);
    try {
      setR(await api.react(tripId, type, on));
    } catch {
      setR(before);
    } finally {
      setBusy(null);
    }
  }

  // Your own story: the counts are shown, but there's nothing for you to tap.
  if (user && user.username.toLowerCase() === author.toLowerCase()) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
        {r.been} {r.been === 1 ? 'reader has' : 'readers have'} been here · {r.want} want to go
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="pill" aria-pressed={r.beenByMe} disabled={busy === 'been'} onClick={() => toggle('been')}>
        Been there · {r.been}
      </button>
      <button type="button" className="pill" aria-pressed={r.wantByMe} disabled={busy === 'want'} onClick={() => toggle('want')}>
        Want to go · {r.want}
      </button>
      {showSave && (
        <button type="button" className="pill" aria-pressed={r.savedByMe} aria-label={r.savedByMe ? 'Saved' : 'Save'} disabled={busy === 'save'}
          onClick={() => toggle('save')} style={{ width: 44, padding: 0, justifyContent: 'center' }}>
          <Icon.bookmark filled={r.savedByMe} />
        </button>
      )}
    </div>
  );
}

export function optimistic(r: Counts, type: ReactionType, on: boolean): Counts {
  const delta = on ? 1 : -1;
  if (type === 'been') return { ...r, beenByMe: on, been: Math.max(0, r.been + delta) };
  if (type === 'want') return { ...r, wantByMe: on, want: Math.max(0, r.want + delta) };
  return { ...r, savedByMe: on };
}
