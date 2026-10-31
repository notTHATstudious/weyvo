import { useEffect, useState } from 'react';

/** A quiet pill while there's no connection: the app keeps working with what's saved on the phone. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" style={{ position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: 0, right: 0, margin: '0 auto', width: 'fit-content', maxWidth: '92vw', zIndex: 81,
      background: '#1C1B18', color: '#FBF8F2', borderRadius: 999, padding: '7px 14px', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,.25)' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#9A948A' }} />
      Offline · showing what's saved on this phone
    </div>
  );
}
