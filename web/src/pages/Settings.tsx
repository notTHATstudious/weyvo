import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icons';
import { useTheme } from '../theme';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { signedIn, signIn, signOut } = useAuth();
  const dark = theme === 'dark';

  return (
    <div className="app">
      <div className="topbar" style={{ padding: '12px 10px 4px' }}>
        <Link to="/u/aarav" className="icon-btn" aria-label="Back"><Icon.back /></Link>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Settings</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <h1 className="display" style={{ margin: '8px 0 20px', fontSize: 40 }}>Settings</h1>

        <div className="paper-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
          <Icon.moon />
          <label htmlFor="dark" style={{ flex: 1, fontSize: 15 }}>Dark theme</label>
          <button id="dark" type="button" role="switch" aria-checked={dark} onClick={() => setTheme(dark ? 'light' : 'dark')}
            style={{ width: 52, height: 32, borderRadius: 999, border: 0, padding: 3, background: dark ? 'var(--green)' : 'var(--line-strong)', display: 'flex', justifyContent: dark ? 'flex-end' : 'flex-start', transition: 'background .2s' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
          </button>
        </div>
        <p style={{ margin: '8px 4px 0', fontSize: 13, color: 'var(--muted)' }}>Short Stories always open in the dark viewer.</p>

        <div className="paper-card" style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <span style={{ fontSize: 15 }}>{signedIn ? 'Signed in (demo)' : 'Signed out (demo)'}</span>
          <button type="button" className="btn btn-outline" style={{ minHeight: 40 }} onClick={signedIn ? signOut : signIn}>{signedIn ? 'Sign out' : 'Sign in'}</button>
        </div>
        <p style={{ margin: '8px 4px 0', fontSize: 13, color: 'var(--muted)' }}>Sign out to see the 60% story gate again. Real accounts arrive with the backend.</p>
      </div>
      <BottomNav />
    </div>
  );
}
