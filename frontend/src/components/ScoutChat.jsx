import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';

const SUGGESTIONS = [
  'Find midfielders under €15M who are high creativity',
  'Who are the top 5 goal scorers in this tournament?',
  'Find me a defensive midfielder who plays like Rodri',
  'Which team has the most clutch performers?',
  'Show me the hidden gems — best value forwards',
  'Who had the best performance in the Final?',
];

function ToolPill({ tool }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'rgba(79,126,247,0.12)', border: '1px solid rgba(79,126,247,0.3)',
      color: '#4f7ef7', borderRadius: 6, padding: '2px 8px', fontSize: 11,
      marginRight: 4, marginBottom: 4,
    }}>
      ⚡ {tool}
    </span>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #4f7ef7, #7c56f5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, marginRight: 10, marginTop: 2,
        }}>⚽</div>
      )}
      <div style={{ maxWidth: '75%' }}>
        {!isUser && msg.toolCalls?.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {msg.toolCalls.map((t, i) => <ToolPill key={i} tool={t.tool} />)}
          </div>
        )}
        <div style={{
          background: isUser ? 'var(--accent)' : 'var(--surface2)',
          color: 'var(--text)',
          borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
          padding: '10px 14px',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          border: isUser ? 'none' : '1px solid var(--border)',
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export default function ScoutChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "I'm Scout AI — your World Cup 2026 intelligence analyst. Ask me anything about players, teams, tactics, or value. I have full stats on 1,248 players across 48 teams.",
      toolCalls: [],
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages([...newMessages, { role: 'assistant', content: '…', toolCalls: [], loading: true }]);
    setLoading(true);

    try {
      // Build API message format (exclude our UI-only fields)
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const result = await api.chat(apiMessages);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: result.content, toolCalls: result.tool_calls || [] },
      ]);
    } catch (e) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error: ${e.message}`, toolCalls: [] },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only when just the intro message) */}
      {messages.length === 1 && (
        <div style={{ padding: '0 24px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--muted)', borderRadius: 20, padding: '5px 12px',
              fontSize: 12, transition: 'all 0.15s',
            }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 24px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 10,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about players, teams, tactics..."
          disabled={loading}
          style={{
            flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 24, padding: '10px 18px', color: 'var(--text)',
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            background: loading ? 'var(--border)' : 'var(--accent)',
            border: 'none', borderRadius: 24, padding: '10px 20px',
            color: '#fff', fontWeight: 500, transition: 'all 0.15s',
            opacity: (!loading && input.trim()) ? 1 : 0.5,
          }}
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>
    </div>
  );
}
