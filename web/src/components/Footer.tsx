import { Link } from 'react-router-dom';

export const LEGAL_LINKS = [
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/privacy', label: 'Privacy' },
  { to: '/legal/refunds', label: 'Refunds' },
  { to: '/legal/guidelines', label: 'Community guidelines' },
  { to: '/legal/contact', label: 'Contact' },
];

/** Copyright and legal links, used on the landing page, the desktop rail, Settings and legal pages. */
export function Footer({ compact }: { compact?: boolean }) {
  return (
    <footer style={{ marginTop: compact ? 0 : 32, padding: compact ? '4px 6px' : '20px 0', borderTop: compact ? 0 : '1px solid var(--line)', fontSize: 12, lineHeight: 1.7, color: 'var(--muted)' }}>
      <nav aria-label="Legal" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
        {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to} style={{ color: 'var(--muted)' }}>{l.label}</Link>)}
      </nav>
      <p style={{ margin: '4px 0 0' }}>© {new Date().getFullYear()} Weyvo. All rights reserved.</p>
    </footer>
  );
}
