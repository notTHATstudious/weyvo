import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useApi } from '../useApi';
import { Icon } from './Icons';

/**
 * The chat button on someone's profile. Only their followers can ask to chat, so it follows the Follow button:
 * request, wait for "accept", then open the chat.
 */
export function MessageButton({ username, following }: { username: string; following: boolean }) {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const { data } = useApi(() => api.chatWith(username), [username, following, version]);
  const [note, setNote] = useState('');
  if (!data || data.state === 'NONE') return null;

  async function tap() {
    setNote('');
    try {
      switch (data!.state) {
        case 'CHAT': return navigate(`/chat/${data!.chatId}`);
        case 'INCOMING': { const s = await api.chatAccept(data!.chatId!); return navigate(`/chat/${s.chatId}`); }
        case 'CAN_REQUEST': await api.chatRequest(username); setNote('Chat request sent'); setVersion((v) => v + 1); return;
        case 'REQUESTED': return setNote('Waiting for them to accept');
        case 'NEEDS_FOLLOW': return setNote('Follow them to send a chat request');
      }
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  const label = { CHAT: 'Message', INCOMING: 'Accept chat request', CAN_REQUEST: 'Send chat request', REQUESTED: 'Chat requested', NEEDS_FOLLOW: 'Message' }[data.state];
  const waiting = data.state === 'REQUESTED' || data.state === 'NEEDS_FOLLOW';
  return (
    <span style={{ position: 'relative', flex: '0 0 auto' }}>
      <button type="button" onClick={tap} aria-label={label} title={label} className="btn btn-outline"
        style={{ minHeight: 44, width: 48, padding: 0, borderColor: data.state === 'INCOMING' ? 'var(--gold)' : 'var(--line-strong)', opacity: waiting ? 0.6 : 1 }}>
        <Icon.chats />
        {data.state === 'INCOMING' && <span aria-hidden="true" className="nav-dot" style={{ position: 'absolute', top: -4, right: -4 }}>1</span>}
      </button>
      {note && (
        <span role="status" style={{ position: 'absolute', top: 50, right: 0, zIndex: 5, whiteSpace: 'nowrap', padding: '6px 10px', borderRadius: 10,
          fontSize: 12, fontWeight: 600, background: 'var(--ink)', color: 'var(--paper)', boxShadow: '0 6px 16px rgba(0,0,0,.2)' }}>{note}</span>
      )}
    </span>
  );
}
