import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  try {
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Theme preference from Settings; applied as data-theme on <html>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // storage unavailable (private mode): theme still applies for this visit
    }
  }, [theme]);

  return { theme, setTheme };
}
