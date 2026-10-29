import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPin } from '../api';

/**
 * OpenStreetMap via Leaflet. Pins are drawn as circles (no image assets); popups are built from DOM nodes
 * with textContent, never HTML strings, because titles are user content.
 */
export function MapView({ pins, color, height = 260, zoom }: { pins: MapPin[]; color: string; height?: number; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { scrollWheelZoom: false, worldCopyJump: true, attributionControl: true }).setView([20, 78], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    for (const p of pins) {
      const marker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#FBF8F2', weight: 2, fillColor: color, fillOpacity: 1 });
      marker.bindPopup(() => popup(p, (to) => navigate(to)));
      marker.addTo(group);
    }
    if (pins.length === 1) m.setView([pins[0].lat, pins[0].lng], zoom ?? 6);
    else if (pins.length > 1) m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [28, 28], maxZoom: 6 });
    else m.setView([20, 78], 2);
  }, [pins, color, zoom, navigate]);

  return <div ref={el} role="region" aria-label="Map" style={{ height, width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', zIndex: 0 }} />;
}

function popup(p: MapPin, go: (to: string) => void) {
  const box = document.createElement('div');
  const title = document.createElement('a');
  title.href = `/places/${p.placeSlug}`;
  title.textContent = p.country ? `${p.name}, ${p.country}` : p.name;
  title.style.fontWeight = '700';
  title.onclick = (e) => { e.preventDefault(); go(`/places/${p.placeSlug}`); };
  box.appendChild(title);
  for (const t of p.trips.slice(0, 3)) {
    const a = document.createElement('a');
    a.href = `/trips/${t.slug}`;
    a.textContent = t.title;
    a.style.display = 'block';
    a.style.marginTop = '4px';
    a.onclick = (e) => { e.preventDefault(); go(`/trips/${t.slug}`); };
    box.appendChild(a);
  }
  return box;
}
