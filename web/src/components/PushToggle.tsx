import { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { pushState, turnOffPush, turnOnPush, type PushState } from '../push';

const HELP: Record<Exclude<PushState, 'on' | 'off'>, string> = {
  'add-to-home-screen': 'On iPhone, add Weyvo to your Home Screen first (Share → Add to Home Screen), then open it from there to turn these on.',
  blocked: 'Notifications are blocked for Weyvo. Allow them in your browser or phone settings, then come back here.',
  unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox, or the Weyvo home-screen app.",
};

/** Notifications on this device: follows, comments, replies, questions and answers. */
export function PushToggle({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  if (state === null || (compact && state !== 'off')) return null;
  const on = state === 'on';
  const canToggle = state === 'on' || state === 'off';

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      setState(on ? await turnOffPush() : await turnOnPush());
    } catch {
      setError("Couldn't change notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paper-card" style={{ marginTop: compact ? 0 : 20, marginBottom: compact ? 14 : 0, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Icon.bell />
        <span id="push-label" style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 15 }}>Notifications on this device</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Follows, comments, replies and questions</span>
        </span>
        {canToggle && (
          <button type="button" role="switch" aria-checked={on} aria-labelledby="push-label" disabled={busy} onClick={toggle}
            style={{ width: 52, height: 32, borderRadius: 999, border: 0, padding: 3, flex: '0 0 auto', background: on ? 'var(--green)' : 'var(--line-strong)', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .2s' }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
          </button>
        )}
      </div>
      {!canToggle && <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{HELP[state as keyof typeof HELP]}</p>}
      {error && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: '#B3261E' }}>{error}</p>}
    </div>
  );
}
