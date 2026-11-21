import { useEffect } from 'react';

/** Fonts the magazine layouts use: Fraunces (Editorial, print) and Caveat (Scrapbook). Loaded only where needed. */
export function useIssueFonts() {
  useEffect(() => {
    if (document.getElementById('issue-fonts')) return;
    const link = document.createElement('link');
    link.id = 'issue-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300;1,9..144,500&family=Caveat:wght@500;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

export const LAYOUTS = [
  { id: 'CLASSIC', name: 'Classic', hint: 'Weyvo magazine', premium: false },
  { id: 'EDITORIAL', name: 'Editorial', hint: 'Serif, drop caps, print feel', premium: false },
  { id: 'SCRAPBOOK', name: 'Scrapbook', hint: 'Polaroids and handwriting', premium: true },
  { id: 'MINIMAL', name: 'Minimal', hint: 'White space, quiet type', premium: true },
] as const;
