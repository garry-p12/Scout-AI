import { useState } from 'react';
import ScoutChat   from './components/ScoutChat';
import PlayerRadar from './components/PlayerRadar';
import ManagerSim  from './components/ManagerSim';
import HiddenGems  from './components/HiddenGems';
import './index.css';

const TABS = [
  { id: 'chat',   label: 'Scout Chat',   icon: '💬', desc: 'Natural language AI' },
  { id: 'radar',  label: 'Player DNA',   icon: '📡', desc: 'Radar & clone finder' },
  { id: 'sim',    label: 'Manager Sim',  icon: '🎮', desc: 'RL match simulation' },
  { id: 'gems',   label: 'Hidden Gems',  icon: '💎', desc: 'Value intelligence' },
];

function Sidebar({ active, onSelect }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontSize: 18, fontWeight: 700,
          background: 'linear-gradient(135deg, #4f7ef7, #7c56f5)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>⚽ Scout AI</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
          FIFA World Cup 2026
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, border: 'none',
              background: active === tab.id ? 'rgba(79,126,247,0.12)' : 'transparent',
              color: active === tab.id ? 'var(--text)' : 'var(--muted)',
              textAlign: 'left', marginBottom: 2, transition: 'all 0.15s',
              cursor: 'pointer',
            }}
            onMouseOver={e => { if (active !== tab.id) e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseOut={e => { if (active !== tab.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <div>
              <div style={{
                fontSize: 13, fontWeight: active === tab.id ? 500 : 400,
                color: active === tab.id ? '#4f7ef7' : 'inherit',
              }}>{tab.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{tab.desc}</div>
            </div>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
        <div>1,248 players · 48 teams</div>
        <div>1,050 matches · 75 metrics</div>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('chat');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={active} onSelect={setActive} />
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Tab header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>{TABS.find(t => t.id === active)?.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {TABS.find(t => t.id === active)?.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {active === 'chat'  && 'Ask anything — the agent picks the right tools automatically'}
              {active === 'radar' && 'Multi-dimensional performance fingerprint + cosine similarity clone search'}
              {active === 'sim'   && 'Monte Carlo simulation powered by player stamina and performance data'}
              {active === 'gems'  && 'Performance z-score vs market value — find who your rivals missed'}
            </div>
          </div>
        </div>

        {/* View */}
        <div style={{ flex: 1 }}>
          {active === 'chat'  && <ScoutChat />}
          {active === 'radar' && <PlayerRadar />}
          {active === 'sim'   && <ManagerSim />}
          {active === 'gems'  && <HiddenGems />}
        </div>
      </main>
    </div>
  );
}
