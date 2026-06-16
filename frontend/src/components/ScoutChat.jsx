import { useState, useRef, useEffect } from 'react';
import { Search, Goal, Dna, Flame, Gem, Trophy } from 'lucide-react';
import AgentBrain from './AgentBrain';
import { api } from '../lib/api';

const SUGGESTIONS = [
  { Icon: Search, text: 'Find midfielders under €15M who are high creativity' },
  { Icon: Goal,   text: 'Who are the top 5 goal scorers in this tournament?' },
  { Icon: Dna,    text: 'Find me a defensive midfielder who plays like Rodri' },
  { Icon: Flame,  text: 'Which team has the most clutch performers?' },
  { Icon: Gem,    text: 'Show me the hidden gems — best value forwards' },
  { Icon: Trophy, text: 'Who had the best performance in the Final?' },
];

function Avatar() {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, marginRight: 11, marginTop: 1,
      boxShadow: '0 6px 16px -6px rgba(91,140,255,0.7)',
    }}>⚽</div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className="fade-up" style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 18,
    }}>
      {!isUser && <Avatar />}
      <div style={{ maxWidth: '74%' }}>
        <div style={{
          background: isUser ? 'linear-gradient(120deg, var(--accent), var(--accent2))' : 'var(--surface2)',
          color: isUser ? '#fff' : 'var(--text)',
          borderRadius: isUser ? '16px 16px 5px 16px' : '5px 16px 16px 16px',
          padding: msg.loading ? '14px 16px' : '12px 16px',
          lineHeight: 1.65, whiteSpace: 'pre-wrap', fontSize: 14,
          border: isUser ? 'none' : '1px solid var(--border)',
          boxShadow: isUser ? '0 8px 22px -8px rgba(91,140,255,0.55)' : 'var(--shadow)',
        }}>
          {msg.loading
            ? <span className="typing"><span /><span /><span /></span>
            : msg.content}
        </div>
      </div>
    </div>
  );
}

export default function ScoutChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [brainState, setBrainState] = useState({ toolCalls: [], isLoading: false, query: '' });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const isEmpty = messages.length === 0;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages([...newMessages, { role: 'assistant', content: '', toolCalls: [], loading: true }]);
    setLoading(true);
    setBrainState({ toolCalls: [], isLoading: true, query: userMsg });

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const result = await api.chat(apiMessages);
      setBrainState({ toolCalls: result.tool_calls || [], isLoading: false, query: userMsg });
      setMessages([...newMessages, { role: 'assistant', content: result.content, toolCalls: result.tool_calls || [] }]);
    } catch (e) {
      setBrainState({ toolCalls: [], isLoading: false, query: userMsg });
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${e.message}`, toolCalls: [] }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 920, margin: '0 auto', width: '100%' }}>
      {/* Agent reasoning graph */}
      {(brainState.isLoading || brainState.toolCalls.length > 0) && (
        <div style={{ paddingTop: 14 }}>
          <AgentBrain
            toolCalls={brainState.toolCalls}
            isLoading={brainState.isLoading}
            queryText={brainState.query}
          />
        </div>
      )}

      {/* Messages / hero */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {isEmpty ? (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 36 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
              boxShadow: '0 14px 40px -10px rgba(91,140,255,0.7)', marginBottom: 18,
            }}>⚽</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 8 }}>
              Your <span className="gradient-text">World Cup 2026</span> analyst
            </h1>
            <p style={{ color: 'var(--muted)', maxWidth: 460, lineHeight: 1.6, marginBottom: 28 }}>
              Ask about players, tactics, value or matches. The agent calls the right tools across
              1,248 players and 75 metrics, then composes an analyst-grade answer.
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 11, width: '100%', maxWidth: 680,
            }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s.text)} className="card hover-lift" style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  padding: '13px 15px', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, lineHeight: 1.4,
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: 'var(--accent-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <s.Icon size={16} strokeWidth={2.2} color="var(--accent)" />
                  </span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '14px 28px 22px' }}>
        <div className="card" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 7px 7px 8px', borderRadius: 16,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about players, teams, tactics…"
            disabled={loading}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              padding: '10px 12px', color: 'var(--text)', fontSize: 14,
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary"
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 7 }}>
            {loading ? <span className="typing"><span /><span /><span /></span> : <>Ask <span style={{ fontSize: 13 }}>↵</span></>}
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 9 }}>
          Powered by an OpenAI orchestrator with 8 specialist data tools
        </div>
      </div>
    </div>
  );
}
