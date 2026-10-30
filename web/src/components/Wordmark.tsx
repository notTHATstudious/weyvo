/** The gold map pin that ends the Weyvo name, sized to the text around it. */
export function Pin({ size = '0.34em' }: { size?: string }) {
  return (
    <svg viewBox="0 0 16 22" aria-hidden="true" style={{ width: size, height: `calc(${size} * 1.375)`, marginLeft: '0.07em', alignSelf: 'flex-end', verticalAlign: 'baseline', marginBottom: '0.16em', flex: '0 0 auto' }}>
      <defs>
        <radialGradient id="weyvo-pin-gold" cx="0.35" cy="0.25" r="0.85">
          <stop offset="0" stopColor="#FFF1C4" />
          <stop offset="0.35" stopColor="#F2C566" />
          <stop offset="0.75" stopColor="#D9982F" />
          <stop offset="1" stopColor="#A9711C" />
        </radialGradient>
      </defs>
      <path d="M8 21.5C8 21.5 1 13.6 1 8.5a7 7 0 1 1 14 0C15 13.6 8 21.5 8 21.5Z" fill="url(#weyvo-pin-gold)" />
      <circle cx="8" cy="8.3" r="2.6" fill="var(--paper, #FBF7EF)" />
    </svg>
  );
}

/** "weyvo" with its gold pin, used wherever the name appears. */
export function Wordmark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={['display', className].filter(Boolean).join(' ')} style={{ fontSize: size, display: 'inline-flex', alignItems: 'baseline' }}>
      weyvo<Pin />
    </span>
  );
}
