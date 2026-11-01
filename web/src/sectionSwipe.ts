import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

/** Things that scroll or pan sideways themselves keep their own swipes. */
const OWN_SWIPES = 'input, textarea, select, [contenteditable], .scroll-x, .leaflet-container, iframe, canvas, [role="dialog"], [data-no-swipe]';
const EDGE = 24; // the screen edges belong to the phone's own back gesture

/**
 * Swipe left or right to move between the main sections, in the bottom bar's order:
 * Discover, Short Stories, Destinations, Plan, Profile. Only on those pages, only for a quick, clearly
 * sideways swipe that didn't start on something that scrolls sideways.
 */
export function useSectionSwipe() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const sections = ['/discover', '/shorts', '/places', '/plan', ...(user ? [`/u/${user.username}`] : [])];
    const here = sections.findIndex((s) => s.toLowerCase() === pathname.toLowerCase());
    if (here < 0) return;
    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      const p = e.touches[0];
      const target = e.target as Element | null;
      if (e.touches.length > 1 || (!target?.closest('[data-swipe-zone]') && (p.clientX < EDGE || p.clientX > window.innerWidth - EDGE)) || target?.closest(OWN_SWIPES)) {
        start = null;
        return;
      }
      start = { x: p.clientX, y: p.clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - start.x;
      const dy = p.clientY - start.y;
      const quick = Date.now() - start.t < 600;
      start = null;
      if (!quick || Math.abs(dx) < 80 || Math.abs(dy) > 50 || window.getSelection()?.toString()) return;
      const to = sections[here + (dx < 0 ? 1 : -1)];
      if (to) navigate(to);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [pathname, user, navigate]);
}
