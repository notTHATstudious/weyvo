import { TAG_LABEL, type TripView } from './api';

export type CardFormat = 'story' | 'square';

const SIZE: Record<CardFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };
const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

/**
 * Draws a story card as a PNG, entirely in the browser: the cover photo (or a green wash without one),
 * the place, title and author, and the Weyvo mark. 9:16 fits Instagram and WhatsApp status; square fits chats.
 */
export async function renderShareCard(trip: TripView, format: CardFormat): Promise<Blob> {
  const [w, h] = SIZE[format];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  await Promise.all([document.fonts.load(`800 100px ${DISPLAY}`), document.fonts.load(`500 40px ${BODY}`)]).catch(() => undefined);

  const photo = trip.cover?.url ? await loadImage(trip.cover.url) : null;
  if (photo) {
    const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const pw = photo.naturalWidth * scale, ph = photo.naturalHeight * scale;
    ctx.drawImage(photo, (w - pw) / 2, (h - ph) / 2, pw, ph);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2F6B52');
    g.addColorStop(1, '#16301F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Darken top and bottom so the text reads on any photo.
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.25);
  top.addColorStop(0, 'rgba(20,14,10,.55)');
  top.addColorStop(1, 'rgba(20,14,10,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.25);
  const bottom = ctx.createLinearGradient(0, h * 0.4, 0, h);
  bottom.addColorStop(0, 'rgba(20,14,10,0)');
  bottom.addColorStop(1, 'rgba(20,14,10,.85)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, h * 0.4, w, h * 0.6);

  const pad = 84;
  ctx.fillStyle = '#FBF8F2';
  ctx.textBaseline = 'alphabetic';

  // Wordmark and kind, top.
  ctx.font = `800 64px ${DISPLAY}`;
  ctx.fillText('weyvo', pad, pad + 56);
  const markWidth = ctx.measureText('weyvo').width;
  ctx.fillStyle = '#E3A23B';
  ctx.beginPath();
  ctx.arc(pad + markWidth + 14, pad + 48, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FBF8F2';
  ctx.font = `600 28px ${BODY}`;
  const kind = trip.kind === 'FULL' ? 'FULL TRIP' : `SHORT STORY${trip.shortTag ? ` · ${TAG_LABEL[trip.shortTag].toUpperCase()}` : ''}`;
  spaced(ctx, kind, w - pad - spacedWidth(ctx, kind, 6), pad + 50, 6);

  // Place, title and author, bottom up.
  const titleSize = format === 'story' ? 118 : 96;
  ctx.font = `800 ${titleSize}px ${DISPLAY}`;
  const lines = wrap(ctx, trip.title, w - pad * 2, 3);
  let y = h - pad - 150;
  ctx.font = `500 34px ${BODY}`;
  ctx.fillStyle = 'rgba(251,248,242,.85)';
  ctx.fillText(`by ${trip.author.username}`, pad, h - pad - 70);
  ctx.font = `500 28px ${BODY}`;
  ctx.fillStyle = 'rgba(251,248,242,.65)';
  ctx.fillText(`Read it on ${window.location.host}`, pad, h - pad);
  ctx.fillStyle = '#FBF8F2';
  ctx.font = `800 ${titleSize}px ${DISPLAY}`;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], pad, y);
    y -= titleSize * 0.98;
  }
  ctx.font = `600 30px ${BODY}`;
  ctx.fillStyle = '#E3A23B';
  spaced(ctx, trip.place.toUpperCase(), pad, y - 10, 7);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'));
}

/** Opens the share sheet with the image where the device supports it, otherwise saves the file. */
export async function shareCardImage(blob: Blob, slug: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], `weyvo-${slug}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

/** A photo the canvas may read. Without CORS permission it would taint the canvas, so it's skipped instead. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number) {
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + gap;
  }
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, gap: number) {
  return [...text].reduce((sum, ch) => sum + ctx.measureText(ch).width + gap, 0) - gap;
}
