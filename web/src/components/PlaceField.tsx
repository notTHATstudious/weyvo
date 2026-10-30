import { useEffect, useRef, useState } from 'react';
import { MiniMap } from './MiniMap';

interface Suggestion { label: string; detail: string; lat: number; lng: number }

/**
 * "Where" with suggestions from OpenStreetMap (Photon, free, no key) and a small map of the chosen place.
 * Picking a suggestion is optional: whatever is typed is kept, and the server places it on the map by name.
 * Only the typed place name is sent to Photon, after a pause in typing.
 */
export function PlaceField({ id, label, value, onChange, error, placeholder, max = 120 }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; max?: number;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const typed = useRef(false);

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 3 || picked?.label === q) {
      setItems([]);
      return;
    }
    const abort = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en&lat=20.6&lon=78.9`, { signal: abort.signal });
        const data = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
        const seen = new Set<string>();
        setItems(data.features.flatMap((f) => {
          const p = f.properties;
          if (!p.name) return [];
          const region = p.state ?? p.county ?? p.country;
          const text = region && region !== p.name ? `${p.name}, ${region}` : p.name;
          if (seen.has(text)) return [];
          seen.add(text);
          return [{ label: text.slice(0, max), detail: [p.city !== p.name ? p.city : null, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }];
        }));
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 400);
    return () => { clearTimeout(t); abort.abort(); };
  }, [value, picked, max]);

  function choose(s: Suggestion) {
    setPicked(s);
    onChange(s.label);
    setOpen(false);
  }

  return (
    <div style={{ marginBottom: 14, position: 'relative' }}>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} className="input" type="text" maxLength={max} value={value} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-expanded={open && items.length > 0} aria-controls={`${id}-list`} aria-invalid={!!error}
        onChange={(e) => { typed.current = true; setPicked(null); onChange(e.target.value); }}
        onFocus={() => items.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={error ? { borderColor: '#B3261E' } : undefined} />
      {open && items.length > 0 && (
        <ul id={`${id}-list`} role="listbox" style={{ listStyle: 'none', margin: '4px 0 0', padding: 4, position: 'absolute', left: 0, right: 0, zIndex: 30,
          background: 'var(--card)', border: '1px solid var(--line-strong)', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
          {items.map((s) => (
            <li key={`${s.label}-${s.lat}`} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}
                style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 12px', borderRadius: 10, color: 'var(--ink)', minHeight: 44 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{s.label}</span>
                {s.detail && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{s.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <MiniMap lat={picked.lat} lng={picked.lng} size={64} zoom={8} />
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>On the map. Your story will show up on this destination's page.</span>
        </div>
      ) : value.trim().length >= 3 && (
        <p style={{ margin: '6px 2px 0', fontSize: 12, color: 'var(--muted)' }}>Pick a suggestion to pin it exactly, or keep what you typed.</p>
      )}
      {error && <p style={{ margin: '6px 2px 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}
