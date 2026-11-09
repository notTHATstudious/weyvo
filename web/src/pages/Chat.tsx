import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, type ChatInbox } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import { ago } from '../components/Talk';

/**
 * Keeps a chat screen current, without lag and without loading the server:
 * - a live stream (instant) while it gets through; then a backup check only every `quietMs`;
 * - if a proxy holds the stream back, checks every `activeMs` while the chat is busy (see `busy`), slowing to
 *   `idleMs` after a quiet minute and speeding up again the moment anything happens.
 * `busy()` says whether something happened recently; `poll` is the (cheap) check.
 */
export function useChatStream(
  onEvent: (name: string, data: unknown) => void,
  poll: () => void,
  speeds: { activeMs: number; idleMs: number; quietMs: number; busy: () => boolean },
) {
  const handlers = useRef({ onEvent, poll, speeds });
  handlers.current = { onEvent, poll, speeds };
  useEffect(() => {
    let source: EventSource | null = null;
    let live = false;
    let next: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    const schedule = () => {
      if (!running) return;
      const s = handlers.current.speeds;
      next = setTimeout(() => { handlers.current.poll(); schedule(); }, live ? s.quietMs : s.busy() ? s.activeMs : s.idleMs);
    };
    // No "hello" within 4 s, or silence for 40 s (pings come every 25 s): the stream is held back somewhere.
    const expect = (ms: number) => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => { live = false; source?.close(); source = null; }, ms);
    };
    const alive = () => { live = true; expect(40_000); };
    const stop = () => {
      running = false;
      source?.close(); source = null; live = false;
      if (next) { clearTimeout(next); next = null; }
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    };
    const start = () => {
      stop();
      running = true;
      handlers.current.poll();
      schedule();
      if (typeof EventSource === 'undefined') return;
      source = new EventSource('/api/chats/stream');
      expect(4000);
      source.addEventListener('hello', alive);
      source.addEventListener('ping', alive);
      for (const name of ['request', 'accepted', 'message', 'seen', 'vanished', 'ended']) {
        source.addEventListener(name, (e) => { alive(); handlers.current.onEvent(name, JSON.parse((e as MessageEvent).data)); });
      }
      source.addEventListener('error', () => { if (source?.readyState === EventSource.CLOSED) { live = false; source = null; } });
    };
    const onVisible = () => (document.visibilityState === 'visible' ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); stop(); };
  }, []);
}

/** The Chat tab: requests from your followers, then your chats. No message text here, like Snapchat. */
export function Chat() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [inbox, setInbox] = useState<ChatInbox | null>(null);
  const [info, setInfo] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.chatInbox().then(setInbox, () => setInbox((x) => x ?? { requests: [], sent: [], chats: [] }));
  useChatStream(() => load(), load, { activeMs: 10_000, idleMs: 10_000, quietMs: 30_000, busy: () => false });

  if (loading) return null;
  if (!user) return <Navigate to="/signin?next=/chat" replace />;

  async function act(action: () => Promise<unknown>) {
    setError('');
    try { await action(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.'); }
    load();
  }

  return (
    <div className="app">
      <header className="chat-hero">
        <span aria-hidden="true" className="chat-hero-glow" />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="display" style={{ margin: 0, fontSize: 26, letterSpacing: '-.01em' }}>Chats</h1>
          <InfoButton open={info} onToggle={() => setInfo(!info)} />
        </div>
        {info && <ChatRules />}
      </header>

      <div style={{ padding: '16px 16px 0' }}>
        {error && <p role="alert" className="chat-error">{error}</p>}
        {inbox === null ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: 30 }}>Loading…</p>
        ) : (
          <>
            {inbox.requests.length > 0 && (
              <section aria-labelledby="req-title" style={{ marginBottom: 20 }}>
                <h2 id="req-title" className="eyebrow" style={{ margin: '0 0 10px', fontWeight: 600 }}>Requests · {inbox.requests.length}</h2>
                {inbox.requests.map((r) => (
                  <div key={r.id} className="chat-request">
                    <Link to={`/u/${r.from.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, color: 'var(--ink)', textDecoration: 'none' }}>
                      <Avatar name={r.from.displayName} url={r.from.avatarUrl} size={46} />
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.from.username}</strong>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>wants to chat · {ago(r.createdAt)}</span>
                      </span>
                    </Link>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="chat-accept" onClick={() => act(async () => { const s = await api.chatAccept(r.id); navigate(`/chat/${s.chatId}`); })}>Accept</button>
                      <button type="button" className="chat-decline" aria-label={`Decline ${r.from.username}`} onClick={() => act(() => api.chatDecline(r.id))}>✕</button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {inbox.chats.length === 0 && inbox.requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <p style={{ margin: 0, fontSize: 54 }} aria-hidden="true">💬</p>
                <p className="display" style={{ margin: '10px 0 0', fontSize: 24 }}>No chats yet</p>
                <p style={{ margin: '8px auto 0', maxWidth: 300, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                  Open a traveller's profile and tap the chat button. People who follow you can ask to chat with you.
                </p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inbox.chats.map((c) => (
                  <li key={c.id}>
                    <Link to={`/chat/${c.id}`} className={`chat-row-link ${c.unread ? 'unread' : ''}`}>
                      <span style={{ position: 'relative', flex: '0 0 auto' }}>
                        <Avatar name={c.with.displayName} url={c.with.avatarUrl} size={50} />
                        {c.unread > 0 && <span aria-hidden="true" className="chat-unread-dot" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.with.username}</strong>
                        <span style={{ fontSize: 13, color: c.unread ? 'var(--green)' : 'var(--muted)', fontWeight: c.unread ? 700 : 500 }}>
                          {c.unread ? `${c.unread > 9 ? '9+' : c.unread} new ${c.unread === 1 ? 'message' : 'messages'}` : 'Tap to chat'}
                        </span>
                      </span>
                      {c.lastAt && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ago(c.lastAt)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {inbox.sent.length > 0 && (
              <p style={{ margin: '18px 4px 0', fontSize: 13, color: 'var(--muted)' }}>
                Waiting for {inbox.sent.map((p) => p.username).join(', ')} to accept
              </p>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

/** The small ⓘ in the header: the chat rules, so the screen itself stays clean. */
export function InfoButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-expanded={open} aria-label="How chat works" className="chat-info">i</button>;
}

export function ChatRules() {
  return (
    <ul className="chat-rules-list">
      <li>👥 Only people who follow you can ask to chat</li>
      <li>👻 Messages disappear once you've both left the chat</li>
      <li>⏳ Read messages go after 2 hours, unread after 12</li>
      <li>✍️ Text and emoji only, no links or phone numbers</li>
    </ul>
  );
}
