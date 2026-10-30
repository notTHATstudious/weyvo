import type { CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icons';

/**
 * Goes back one step in the app's own history, like the phone's back gesture. Opened from a link or a
 * home-screen icon there is nothing to go back to, so it goes to `fallback` instead. Never pushes a new
 * page, so two pages can't bounce the reader between each other.
 */
export function BackButton({ fallback, label = 'Back', solid, style }: { fallback: string; label?: string; solid?: boolean; style?: CSSProperties }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasHistory = location.key !== 'default';
  return (
    <button type="button" className={solid ? 'icon-btn solid' : 'icon-btn'} aria-label={label} style={style}
      onClick={() => (hasHistory ? navigate(-1) : navigate(fallback, { replace: true }))}>
      <Icon.back />
    </button>
  );
}
