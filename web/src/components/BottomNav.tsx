import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { Icon } from './Icons';

export function BottomNav() {
  const { user } = useAuth();
  const items = [
    { to: '/discover', label: 'Discover', icon: <Icon.compass /> },
    { to: '/shorts', label: 'Short Stories', icon: <Icon.play /> },
    { to: '/create', label: 'Create', icon: <Icon.plus />, create: true },
    { to: '/places/kyoto', label: 'Destinations', icon: <Icon.pin /> },
    { to: user ? `/u/${user.username}` : '/signin?next=/discover', label: 'Your magazine', icon: <Icon.user /> },
  ];

  return (
    <nav className="bottom-nav" aria-label="App">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} aria-label={i.label}
          className={({ isActive }) => [i.create ? 'create' : '', isActive && !i.create ? 'active' : ''].join(' ')}>
          {i.icon}
        </NavLink>
      ))}
    </nav>
  );
}
