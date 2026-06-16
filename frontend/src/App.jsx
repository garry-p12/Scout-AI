import { useState, useEffect } from 'react';
import { MessageSquare, Dna, Gamepad2, Gem } from 'lucide-react';
import ScoutChat   from './components/ScoutChat';
import PlayerRadar from './components/PlayerRadar';
import ManagerSim  from './components/ManagerSim';
import HiddenGems  from './components/HiddenGems';
import { api } from './lib/api';
import './index.css';

const TABS = [
  { id: 'chat',  label: 'Scout Chat',  Icon: MessageSquare, desc: 'Natural-language AI analyst',
    sub: 'Ask anything — the agent picks the right tools automatically' },
  { id: 'radar', label: 'Player DNA',  Icon: Dna, desc: 'Radar & clone finder',
    sub: 'Multi-dimensional performance fingerprint + cosine-similarity clone search' },
  { id: 'sim',   label: 'Manager Sim', Icon: Gamepad2, desc: 'Monte Carlo match engine',
    sub: 'Simulate the second half from live stamina and performance data' },
  { id: 'gems',  label: 'Hidden Gems', Icon: Gem, desc: 'Value intelligence',
    sub: 'Performance z-score vs market value — find who your rivals missed' },
];

function Sidebar({ active, onSelect, health }) {
  return (
    <aside style={{
      width: 248, flexShrink: 0,
      background: 'var(--bg-soft)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 19, boxShadow: '0 6px 18px -4px rgba(91,140,255,0.6)',
          }}>⚽</div>
          <div>
            <div className="gradient-text" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.02em' }}>
              Scout AI
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1, letterSpacing: '.04em' }}>
              FIFA WORLD CUP 2026
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '6px 12px', flex: 1 }}>
        <div className="section-label" style={{ padding: '8px 10px 6px' }}>Workspace</div>
        {TABS.map(tab => {
          const on = active === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              style={{
                position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', borderRadius: 11, border: '1px solid transparent',
                background: on ? 'var(--surface)' : 'transparent',
                borderColor: on ? 'var(--border)' : 'transparent',
                boxShadow: on ? 'var(--shadow)' : 'none',
                color: on ? 'var(--text)' : 'var(--text2)',
                textAlign: 'left', marginBottom: 4, transition: 'all .15s', cursor: 'pointer',
              }}
              onMouseOver={e => { if (!on) e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
              onMouseOut={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}
            >
              {on && <span style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 22, borderRadius: 3,
                background: 'linear-gradient(var(--accent), var(--accent2))',
              }} />}
              <span style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface2)',
                border: on ? 'none' : '1px solid var(--border)',
              }}>
                <Icon size={16} strokeWidth={2.2} color={on ? '#fff' : 'var(--muted)'} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: on ? 600 : 500 }}>{tab.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tab.desc}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Status / footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" style={{ background: health ? 'var(--green)' : 'var(--amber)' }} />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{health ? 'Engine online' : 'Connecting…'}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {health ? `${health.players?.toLocaleString()} players · ${health.matches?.toLocaleString()} matches` : 'localhost:8000'}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 8, letterSpacing: '.02em' }}>
          1,248 players · 48 teams · 75 metrics
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [active, setActive] = useState('chat');
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let alive = true;
    const ping = () => api.health().then(h => alive && setHealth(h)).catch(() => alive && setHealth(null));
    ping();
    const t = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const tab = TABS.find(t => t.id === active);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={active} onSelect={setActive} health={health} />
      <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header className="glass" style={{
          padding: '15px 28px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 20,
        }}>
          <span style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent-soft)', border: '1px solid var(--border)',
          }}>
            {tab && <tab.Icon size={19} strokeWidth={2.2} color="var(--accent)" />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.01em' }}>{tab?.label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab?.sub}
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            background: health ? 'rgba(31,181,116,0.10)' : 'rgba(245,166,35,0.10)',
            border: `1px solid ${health ? 'rgba(31,181,116,0.28)' : 'rgba(245,166,35,0.28)'}`,
            borderRadius: 999, padding: '6px 13px', fontSize: 12, fontWeight: 600,
            color: health ? 'var(--green)' : 'var(--amber)',
          }}>
            <span className="live-dot" style={{ background: health ? 'var(--green)' : 'var(--amber)' }} />
            {health ? 'Live data' : 'Offline'}
          </div>
        </header>

        {/* View */}
        <div key={active} className="fade-up" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {active === 'chat'  && <ScoutChat />}
          {active === 'radar' && <PlayerRadar />}
          {active === 'sim'   && <ManagerSim />}
          {active === 'gems'  && <HiddenGems />}
        </div>
      </main>
    </div>
  );
}
