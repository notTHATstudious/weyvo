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

  const summary = empty
    ? layer === 'been' ? 'No places yet' : 'Nothing saved yet'
    : layer === 'been' ? `${data.places} place${data.places === 1 ? '' : 's'} · ${data.countries} countr${data.countries === 1 ? 'y' : 'ies'}` : `${pins.length} place${pins.length === 1 ? '' : 's'}`;

  // Layer tabs sit above the map, not on it, so the map's own controls stay clear.
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div role="tablist" aria-label="Map layer" style={{ display: 'flex', gap: 6 }}>
          <button type="button" role="tab" aria-selected={layer === 'been'} className="tab" onClick={() => setLayer('been')} style={{ minHeight: 34, padding: '0 14px', fontSize: 13 }}>
            Been
          </button>
          {showWant && (
            <button type="button" role="tab" aria-selected={layer === 'want'} className="tab" onClick={() => setLayer('want')} style={{ minHeight: 34, padding: '0 14px', fontSize: 13 }}>
              Want to go
            </button>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{summary}</span>
      </div>
      <MapView pins={pins} color={layer === 'been' ? '#1F4D3A' : '#C77A12'} />
      {empty && (
        <p style={{ margin: '8px 2px 0', fontSize: 13, color: 'var(--muted)' }}>
          {layer === 'been' ? 'Stories appear here once their place is found.' : 'Tap Want to go on a story or destination to plan your next trip.'}
        </p>
      )}
    </div>
  );
}
