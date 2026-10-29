import { avatarOf } from '../api';

/** A person's profile picture, or their initial on a colour when they haven't uploaded one. */
export function Avatar({ name, url, size = 34, ring }: { name: string; url?: string | null; size?: number; ring?: string }) {
  const fallback = avatarOf(name);
  const style = {
    width: size, height: size, flex: `0 0 ${size}px`, borderRadius: '50%', objectFit: 'cover' as const,
    border: ring ? `2px solid ${ring}` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  if (url) return <img src={url} alt="" aria-hidden="true" loading="lazy" style={{ ...style, background: 'var(--line)' }} />;
  return (
    <span aria-hidden="true" style={{ ...style, background: fallback.color, color: '#FBF8F2', fontSize: Math.round(size * 0.4), fontWeight: 600 }}>
      {fallback.initial}
    </span>
  );
}
