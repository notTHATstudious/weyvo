import { Link, NavLink } from 'react-router-dom';
import { api } from '../api';
import { useApi } from '../useApi';
import { useAuth } from '../auth';
import { Icon } from './Icons';

/** A bottom bar on phones; on wide screens CSS turns it into a labelled left sidebar. */
export function BottomNav() {
  const { user } = useAuth();
  const unread = useApi(() => (user ? api.unreadCount() : Promise.resolve({ count: 0 })), [user?.id]);
  const items = [
    { to: '/discover', label: 'Discover', icon: <Icon.compass /> },
    { to: '/shorts', label: 'Short Stories', icon: <Icon.play /> },
    { to: '/create', label: 'Create', icon: <Icon.plus />, create: true },
    { to: '/places', label: 'Destinations', icon: <Icon.pin /> },
    { to: user ? `/u/${user.username}` : '/signin?next=/discover', label: 'Your magazine', icon: <Icon.user /> },
  ];

  return (
    <nav className="bottom-nav" aria-label="App">
      <Link to="/discover" className="nav-brand display" aria-label="Weyvo home">weyvo<span style={{ color: 'var(--gold)' }}>.</span></Link>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} aria-label={i.label}
          className={({ isActive }) => [i.create ? 'create' : '', isActive && !i.create ? 'active' : ''].join(' ')}>
          {i.icon}
          <span className="nav-label" aria-hidden="true">{i.label}</span>
        </NavLink>
      ))}
      {user && (
        <NavLink to="/notifications" className={({ isActive }) => `nav-extra nav-notify ${isActive ? 'active' : ''}`}
          aria-label={unread.data?.count ? `Notifications, ${unread.data.count} new` : 'Notifications'}>
          <Icon.bell />
          <span className="nav-label" aria-hidden="true">Notifications</span>
          {!!unread.data?.count && <span aria-hidden="true" className="nav-dot">{unread.data.count > 9 ? '9+' : unread.data.count}</span>}
        </NavLink>
      )}
      <Link to="/settings" className="nav-extra nav-settings" aria-label="Settings"><Icon.settings /><span className="nav-label" aria-hidden="true">Settings</span></Link>
    </nav>
  );
}
