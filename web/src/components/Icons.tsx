import type { ReactNode } from 'react';

type P = { size?: number };

const svg = (size: number, children: ReactNode, strokeWidth = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const Icon = {
  compass: ({ size = 22 }: P) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  play: ({ size = 22 }: P) => svg(size, <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M10.5 9.5v5l4-2.5z" /></>),
  plus: ({ size = 22 }: P) => svg(size, <path d="M12 5v14M5 12h14" />, 2.2),
  /** A folded map with a route: planning a trip (BubDub's Atlas). */
  route: ({ size = 22 }: P) => svg(size, <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
  pin: ({ size = 22 }: P) => svg(size, <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
  user: ({ size = 22 }: P) => svg(size, <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
  bell: ({ size = 22 }: P) => svg(size, <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  search: ({ size = 22 }: P) => svg(size, <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  back: ({ size = 20 }: P) => svg(size, <path d="M15 6l-6 6 6 6" />, 2),
  close: ({ size = 22 }: P) => svg(size, <path d="M6 6l12 12M18 6L6 18" />, 2),
  share: ({ size = 20 }: P) => svg(size, <path d="M4 12v7h16v-7M12 3v12M7 8l5-5 5 5" />),
  check: ({ size = 22 }: P) => svg(size, <path d="M5 12l5 5L20 7" />),
  chat: ({ size = 22 }: P) => svg(size, <path d="M4 5h16v11H9l-5 4z" />),
  bookmark: ({ size = 18, filled }: P & { filled?: boolean }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
  ),
  chevronDown: ({ size = 18 }: P) => svg(size, <path d="M6 9l6 6 6-6" />, 2),
  chevronUp: ({ size = 22 }: P) => svg(size, <path d="M6 15l6-6 6 6" />, 2),
  chevronRight: ({ size = 18 }: P) => svg(size, <path d="M9 6l6 6-6 6" />),
  settings: ({ size = 22 }: P) => svg(size, <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>),
  moon: ({ size = 20 }: P) => svg(size, <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />),
};
