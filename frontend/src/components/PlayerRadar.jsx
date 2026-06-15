import { useState, useEffect } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../lib/api';

const METRICS = [
  { key: 'total_goals_tournament', label: 'Goals', suffix: '' },
  { key: 'tournament_rating', label: 'Rating', suffix: '' },
  { key: 'creativity_score', label: 'Creativity', suffix: '' },
  { key: 'clutch_performance_score', label: 'Clutch', suffix: '' },
];

function StatBadge({ label, value, color = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

function CloneCard({ clone, onSelect }) {
  return (
    <div
      onClick={() => onSelect(clone.player_id)}
      style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 500 }}>{clone.player_name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
            {clone.team} · {clone.position}
          </div>
        </div>
        <div style={{
          background: 'rgba(79,126,247,0.15)', color: 'var(--accent)',
          borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600,
        }}>
          {Math.round(clone.similarity * 100)}% match
        </div>
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
        <span>⭐ {clone.player_rating}</span>
        <span>€{(clone.market_value_eur / 1_000_000).toFixed(1)}M</span>
      </div>
    </div>
  );
}

export default function PlayerRadar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [radar, setRadar] = useState(null);
  const [clones, setClones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  async function doSearch(q) {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await api.searchPlayers({ name: q, limit: 8 });
      setResults(r);
    } finally {
      setSearching(false);
    }
  }

  async function selectPlayer(id) {
    setLoading(true);
    setResults([]);
    setQuery('');
    try {
      const [radarData, clonesData] = await Promise.all([
        api.getRadar(id),
        api.getClones(id, 4),
      ]);
      setRadar(radarData);
      setClones(clonesData);
      const detail = await api.getPlayer(id);
      setSelected(detail);
    } finally {
      setLoading(false);
    }
  }

  const radarData = radar ? Object.entries(radar.axes).map(([axis, value]) => ({
    axis,
    player: Math.round(value),
    avg: Math.round(radar.position_avg[axis] || 0),
  })) : [];

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 400 }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value.length > 1) doSearch(e.target.value); }}
          placeholder="Search any player..."
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 24, padding: '10px 18px', color: 'var(--text)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => setTimeout(() => { setResults([]); e.target.style.borderColor = 'var(--border)'; }, 200)}
        />
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, marginTop: 4, overflow: 'hidden',
          }}>
            {results.map(r => (
              <div
                key={r.player_id}
                onMouseDown={() => selectPlayer(r.player_id)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontWeight: 500 }}>{r.player_name}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>
                  {r.team} · {r.position}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>Loading...</div>}

      {!selected && !loading && (
        <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div>Search a player to see their DNA fingerprint and tactical clones</div>
        </div>
      )}

      {selected && radar && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Player info + radar */}
          <div>
            {/* Header */}
            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20, marginBottom: 16,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selected.player_name}</div>
              <div style={{ color: 'var(--muted)', marginBottom: 12 }}>
                {selected.team} · {selected.position} · {selected.nationality}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <StatBadge label="Goals" value={selected.total_goals_tournament} color="var(--green)" />
                <StatBadge label="Assists" value={selected.total_assists_tournament} color="var(--accent)" />
                <StatBadge label="Rating" value={selected.player_rating?.toFixed(1)} color="var(--amber)" />
                <StatBadge label="Value" value={`€${(selected.market_value_eur / 1_000_000).toFixed(0)}M`} color="var(--muted)" />
              </div>
            </div>

            {/* Radar */}
            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: 'var(--muted)' }}>
                PERFORMANCE DNA
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, marginBottom: 8, color: 'var(--muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 2, background: '#4f7ef7' }} />
                  {selected.player_name}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 2, background: '#3dd68c', opacity: 0.6 }} />
                  Position avg
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Radar name="Position avg" dataKey="avg" stroke="#3dd68c" fill="#3dd68c" fillOpacity={0.12} strokeOpacity={0.6} />
                  <Radar name={selected.player_name} dataKey="player" stroke="#4f7ef7" fill="#4f7ef7" fillOpacity={0.25} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text)' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Clones + detail stats */}
          <div>
            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: 'var(--muted)' }}>
                TACTICAL CLONES — most similar across 15 performance dimensions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {clones.map(c => <CloneCard key={c.player_id} clone={c} onSelect={selectPlayer} />)}
              </div>
            </div>

            <div style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: 'var(--muted)' }}>
                ADVANCED METRICS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Creativity', selected.creativity_score?.toFixed(1)],
                  ['Clutch', selected.clutch_performance_score?.toFixed(1)],
                  ['Pressure Res.', selected.pressure_resistance?.toFixed(1)],
                  ['Consistency', selected.consistency_score?.toFixed(1)],
                  ['Offense', selected.offensive_contribution?.toFixed(1)],
                  ['Defense', selected.defensive_contribution?.toFixed(1)],
                  ['xG', selected.expected_goals_xg?.toFixed(2)],
                  ['xA', selected.expected_assists_xa?.toFixed(2)],
                ].map(([label, val]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
