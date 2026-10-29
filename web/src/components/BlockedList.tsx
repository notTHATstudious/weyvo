import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar } from './Avatar';
import { useApi } from '../useApi';

/** The people you blocked, with Unblock. Shown in Settings. */
export function BlockedList() {
  const [version, setVersion] = useState(0);
  const { data } = useApi(() => api.blocked(), [version]);

  return (
    <div className="paper-card" style={{ marginTop: 20, padding: '14px 16px' }}>
      <h2 className="display" style={{ margin: 0, fontSize: 22 }}>Blocked accounts</h2>
      {!data?.length ? (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>No one. Block someone from their profile.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
          {data.map((b) => (
            <li key={b.username} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <Avatar name={b.displayName} url={b.avatarUrl} size={34} />
              <Link to={`/u/${b.username}`} style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>{b.username}</Link>
              <button type="button" className="btn btn-outline" style={{ minHeight: 36, fontSize: 13 }}
                onClick={async () => { await api.block(b.username, false); setVersion((v) => v + 1); }}>Unblock</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
