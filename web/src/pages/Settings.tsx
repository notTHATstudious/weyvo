import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { AccountSettings } from '../components/AccountSettings';
import { BlockedList } from '../components/BlockedList';
import { Footer } from '../components/Footer';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { useTheme } from '../theme';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dark = theme === 'dark';

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}><Icon.back /></button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Settings</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display" style={{ margin: '8px 0 20px', fontSize: 40 }}>Settings</h1>

        <div className="paper-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <Icon.moon />
          <span id="dark-label" style={{ flex: 1, fontSize: 15 }}>Dark theme</span>
          <button type="button" role="switch" aria-checked={dark} aria-labelledby="dark-label" onClick={() => setTheme(dark ? 'light' : 'dark')}
            style={{ width: 52, height: 32, borderRadius: 999, border: 0, padding: 3, background: dark ? 'var(--green)' : 'var(--line-strong)', display: 'flex', justifyContent: dark ? 'flex-end' : 'flex-start', transition: 'background .2s' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
          </button>
        </div>
        <p style={{ margin: '8px 4px 0', fontSize: 13, color: 'var(--muted)' }}>Short Stories always open in the dark viewer.</p>

        <div className="paper-card" style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px' }}>
          {user ? (
            <>
              <span style={{ fontSize: 15, minWidth: 0 }}>Signed in as <strong>{user.username}</strong></span>
              <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={async () => { await logout(); navigate('/discover'); }}>Sign out</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 15 }}>You're not signed in</span>
              <Link to="/signin?next=/settings" className="btn btn-primary" style={{ minHeight: 40 }}>Sign in</Link>
            </>
          )}
        </div>
        {user?.admin && (
          <Link to="/admin" className="paper-card" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', color: 'var(--ink)', textDecoration: 'none' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Admin dashboard</span><Icon.chevronRight />
          </Link>
        )}
        <AccountSettings />
        {user && <BlockedList />}
        <Footer />
      </div>
      <BottomNav />
    </div>
  );
}
