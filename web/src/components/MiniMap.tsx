const TILE = 128; // OpenStreetMap tiles are 256px; drawn at half size so they stay sharp on phones.

/**
 * A small static map centred on a place: a few OpenStreetMap tiles and a dot, no map library.
 * Light enough to show one per row in a list. Pages using it must credit OpenStreetMap.
 */
export function MiniMap({ lat, lng, size = 76, zoom = 9 }: { lat: number; lng: number; size?: number; zoom?: number }) {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  const px = ((lng + 180) / 360) * n * TILE;
  const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * TILE;
  const left = size / 2 - px;
  const top = size / 2 - py;
  const tiles: { x: number; y: number }[] = [];
  for (let x = Math.floor((px - size / 2) / TILE); x <= Math.floor((px + size / 2) / TILE); x++) {
    for (let y = Math.floor((py - size / 2) / TILE); y <= Math.floor((py + size / 2) / TILE); y++) {
      if (y >= 0 && y < n) tiles.push({ x, y });
    }
  }

  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'block', flex: `0 0 ${size}px`, width: size, height: size, borderRadius: 14, overflow: 'hidden', background: '#E8E1D3' }}>
      {tiles.map(({ x, y }) => (
        <img key={`${x}-${y}`} src={`https://tile.openstreetmap.org/${zoom}/${((x % n) + n) % n}/${y}.png`} alt="" loading="lazy" draggable={false}
          style={{ position: 'absolute', left: left + x * TILE, top: top + y * TILE, width: TILE, height: TILE, maxWidth: 'none' }} />
      ))}
      <span style={{ position: 'absolute', left: size / 2 - 7, top: size / 2 - 7, width: 14, height: 14, borderRadius: '50%', background: '#1F4D3A', border: '2.5px solid #FBF8F2', boxShadow: '0 1px 4px rgba(0,0,0,.35)' }} />
    </span>
  );
}
