import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, type ChatMessage, type ChatPerson } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icons';
import { ago } from '../components/Talk';
import { ChatRules, InfoButton, useChatStream } from './Chat';

const EMOJI = ['😀', '😂', '😍', '🥹', '😎', '🤩', '🙌', '👍', '🔥', '❤️', '✈️', '🏔️', '🏖️', '🚂', '📸', '🧳'];
const MAX = 500;

/** One private chat. Read messages stay while either of you is here, then vanish once you've both left. */
export function ChatThread() {
  const { id = '' } = useParams();
  const chatId = Number(id);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [other, setOther] = useState<ChatPerson | null>(null);
  const [vanished, setVanished] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [gone, setGone] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    api.chatOpen(chatId).then(setMessages, (err) => { if (err instanceof ApiError && err.status === 404) setGone(true); });
    if (!other) api.chatInbox().then((i) => setOther(i.chats.find((c) => c.id === chatId)?.with ?? null), () => {});
  };

  useChatStream(chatId, (name, data) => {
    const d = data as { chatId?: number; ids?: number[] } & Partial<ChatMessage>;
    if (d.chatId !== chatId) return;
    if (name === 'message') setMessages((ms) => (ms ?? []).some((m) => m.id === d.id) ? ms : [...(ms ?? []), d as ChatMessage]);
    if (name === 'seen') setMessages((ms) => (ms ?? []).map((m) => (d.ids!.includes(m.id) ? { ...m, readAt: new Date().toISOString() } : m)));
    if (name === 'vanished') { setMessages((ms) => (ms ?? []).filter((m) => !d.ids!.includes(m.id))); setVanished(true); }
    if (name === 'ended') setGone(true);
  }, load);

  useLayoutEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  if (loading) return null;
  if (!user) return <Navigate to={`/signin?next=/chat/${id}`} replace />;
  if (gone) {
    return (
      <div className="app" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 48, margin: '40px 0 0' }} aria-hidden="true">👋</p>
        <p className="display" style={{ fontSize: 24, margin: '10px 0 0' }}>This chat has ended</p>
        <Link to="/chat" className="btn btn-primary" style={{ marginTop: 18 }}>Back to chats</Link>
      </div>
    );
  }

  const lastMine = [...(messages ?? [])].reverse().find((m) => m.sender === user.username);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const m = await api.chatSend(chatId, body);
      setMessages((ms) => (ms ?? []).some((x) => x.id === m.id) ? ms : [...(ms ?? []), m]);
      setText('');
      setEmoji(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  async function act(action: () => Promise<unknown>, after?: () => void) {
    setMenu(false);
    try { await action(); after?.(); } catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.'); }
  }

  return (
    <div className="app chat-page thread">
      <header className="chat-thread-bar">
        <button type="button" className="icon-btn" aria-label="Back to chats" onClick={() => navigate('/chat')}><Icon.back /></button>
        {other ? (
          <Link to={`/u/${other.username}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, color: 'var(--ink)', textDecoration: 'none' }}>
            <Avatar name={other.displayName} url={other.avatarUrl} size={36} />
            <strong style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other.username}</strong>
          </Link>
        ) : <span style={{ flex: 1 }} />}
        <InfoButton open={info} onToggle={() => setInfo(!info)} />
        <button type="button" className="icon-btn" aria-label="Chat options" aria-expanded={menu} onClick={() => setMenu(true)} style={{ fontSize: 22, fontWeight: 700 }}>⋯</button>
      </header>
      {info && <div style={{ padding: '10px 16px 0' }}><div className="paper-card" style={{ padding: '10px 14px' }}><ChatRules /></div></div>}

      <div role="log" aria-live="polite" aria-label="Messages" style={{ padding: '14px 14px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages !== null && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 16px 10px', color: 'var(--muted)' }}>
            <p style={{ margin: 0, fontSize: 42 }} aria-hidden="true">{vanished ? '👻' : '👋'}</p>
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>{vanished ? 'Messages vanished' : `Say hi to ${other?.username ?? 'your new travel friend'}`}</p>
          </div>
        )}
        {(messages ?? []).map((m, i) => {
          const mine = m.sender === user.username;
          const prev = messages![i - 1];
          return (
            <div key={m.id} className={`chat-row ${mine ? 'mine' : ''}`} style={{ marginTop: !prev || prev.sender !== m.sender ? 10 : 0 }}>
              <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <span className={`chat-bubble ${mine ? 'mine' : ''} ${emojiOnly(m.body) ? 'big' : ''}`} style={{ cursor: 'default' }}>
                  {m.body}<span className="chat-time">{ago(m.createdAt)}</span>
                </span>
                {mine && m.id === lastMine?.id && <span className="chat-status">{m.readAt ? 'Seen' : 'Sent'}</span>}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <div className="chat-dock no-nav">
        {emoji && (
          <div className="chat-emoji" role="group" aria-label="Add emoji">
            {EMOJI.map((e) => <button key={e} type="button" onClick={() => setText((t) => (t + e).slice(0, MAX))} aria-label={`Add ${e}`}>{e}</button>)}
          </div>
        )}
        {error && <p role="alert" className="chat-error">{error}</p>}
        <form onSubmit={send} className="chat-composer">
          <button type="button" className="chat-emoji-toggle" aria-label={emoji ? 'Hide emoji' : 'Show emoji'} aria-pressed={emoji} onClick={() => setEmoji(!emoji)}>😊</button>
          <label htmlFor="chat-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Message</label>
          <textarea id="chat-input" ref={input} rows={1} maxLength={MAX} value={text} placeholder="Message…"
            onChange={(e) => { setText(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button type="submit" className="chat-send" aria-label="Send" disabled={!text.trim() || sending}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </form>
        <p aria-live="polite" style={{ margin: '5px 16px 0', fontSize: 11, textAlign: 'right', fontWeight: text.length >= MAX ? 700 : 500,
          color: text.length >= MAX ? '#B3261E' : text.length > MAX * 0.8 ? 'var(--gold)' : 'var(--muted)' }}>
          {text.length >= MAX ? `Max ${MAX} characters reached` : `${text.length} / ${MAX}`}
        </p>
      </div>

      {menu && other && (
        <div className="chat-sheet-backdrop" onClick={() => setMenu(false)}>
          <div role="dialog" aria-label="Chat options" className="chat-sheet" onClick={(e) => e.stopPropagation()}>
            <span className="chat-sheet-grip" aria-hidden="true" />
            <button type="button" className="chat-sheet-btn" onClick={() => act(() => api.chatReport(chatId), () => setError(`Thanks. We saved the recent messages for the Weyvo team.`))}>🚩 Report {other.username}</button>
            <button type="button" className="chat-sheet-btn" onClick={() => act(() => api.block(other.username, true), () => navigate('/chat', { replace: true }))}>🙈 Block {other.username}</button>
            <button type="button" className="chat-sheet-btn" style={{ color: '#B3261E' }} onClick={() => act(() => api.chatEnd(chatId), () => navigate('/chat', { replace: true }))}>👋 End chat</button>
            <button type="button" className="chat-sheet-btn" onClick={() => setMenu(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** One to three emoji and nothing else: shown large. */
function emojiOnly(s: string) {
  return /^(\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|\p{Emoji_Modifier})*\s*){1,3}$/u.test(s.trim());
}
