import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../useApi';
import { MapView } from './MapView';

/** A person's real travel map. "Want to go" appears only on your own profile (it's a private list). */
export function TravelMap({ username }: { username: string }) {
  const { data } = useApi(() => api.travelMap(username), [username]);
  const [layer, setLayer] = useState<'been' | 'want'>('been');
  if (!data) return <div style={{ height: 260, borderRadius: 'var(--radius-lg)', background: 'var(--line)' }} />;

  const showWant = data.want !== null;
  const pins = layer === 'want' && data.want ? data.want : data.been;
  const empty = pins.length === 0;

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <MapView pins={pins} color={layer === 'been' ? '#1F4D3A' : '#C77A12'} />
        <div role="tablist" aria-label="Map layer" style={{ position: 'absolute', left: 10, top: 10, zIndex: 500, display: 'flex', gap: 4, background: 'var(--card)', borderRadius: 999, padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
          <button type="button" role="tab" aria-selected={layer === 'been'} className="tab" onClick={() => setLayer('been')} style={{ minHeight: 32, padding: '0 12px', fontSize: 12, border: 0 }}>
            Been · {data.been.length}
          </button>
          {showWant && (
            <button type="button" role="tab" aria-selected={layer === 'want'} className="tab" onClick={() => setLayer('want')} style={{ minHeight: 32, padding: '0 12px', fontSize: 12, border: 0 }}>
              Want to go · {data.want!.length}
            </button>
          )}
        </div>
      </div>
      <p style={{ margin: '8px 2px 0', fontSize: 13, color: 'var(--muted)' }}>
        {empty
          ? layer === 'been' ? 'No places on the map yet. Stories appear here once their place is found.' : 'Tap Want to go on stories to plan your next trip.'
          : layer === 'been' ? `${data.places} place${data.places === 1 ? '' : 's'} in ${data.countries} countr${data.countries === 1 ? 'y' : 'ies'}` : `${pins.length} place${pins.length === 1 ? '' : 's'} on your list`}
      </p>
    </div>
  );
}
