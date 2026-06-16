import { useState, useEffect } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import PlayerUniverse from './PlayerUniverse';
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

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function CloneCard({ clone, onSelect }) {
  const pct = Math.round(clone.similarity * 100);
  return (
    <div onClick={() => onSelect(clone.player_id)} className="card hover-lift" style={{
      padding: '12px 14px', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0, fontSize: 12, fontWeight: 700,
            background: 'var(--surface3)', border: '1px solid var(--border2)', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{initials(clone.player_name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clone.player_name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 1 }}>{clone.team} · {clone.position}</div>
          </div>
        </div>
        <div style={{
          background: 'rgba(91,140,255,0.14)', color: 'var(--accent)', flexShrink: 0,
          borderRadius: 7, padding: '3px 9px', fontSize: 12, fontWeight: 700,
        }}>{pct}%</div>
      </div>
      {/* similarity bar */}
      <div style={{ marginTop: 10, height: 5, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} />
      </div>
      <div style={{ marginTop: 9, display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)' }}>
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
  const [showUniverse, setShowUniverse] = useState(true);
  const [highlightIds, setHighlightIds] = useState([]);

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
      setHighlightIds([id, ...clonesData.map(c => c.player_id)]);
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
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', maxWidth: 1080, margin: '0 auto' }}>
      {/* Player Universe */}
      {showUniverse ? (
        <div className="card" style={{ height: 320, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <PlayerUniverse onPlayerSelect={selectPlayer} highlightIds={highlightIds} />
          <button onClick={() => setShowUniverse(false)} style={{
            position: 'absolute', top: 12, left: 12, zIndex: 6, fontSize: 11.5,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 11px', color: 'var(--text2)', boxShadow: 'var(--shadow)',
          }}>Hide universe</button>
        </div>
      ) : (
        <button onClick={() => setShowUniverse(true)} style={{
          marginBottom: 16, fontSize: 12.5,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 9, padding: '8px 14px', color: 'var(--text2)', boxShadow: 'var(--shadow)',
        }}>🌌 Show player universe</button>
      )}

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 24, maxWidth: 440 }}>
        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 15 }}>🔍</span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (e.target.value.length > 1) doSearch(e.target.value); }}
          placeholder="Search any player by name…"
          className="focus-ring"
          style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '11px 18px 11px 42px', color: 'var(--text)', outline: 'none',
            transition: 'border-color .15s, box-shadow .15s',
          }}
          onBlur={e => setTimeout(() => { setResults([]); }, 200)}
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

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="skeleton" style={{ height: 420 }} />
          <div className="skeleton" style={{ height: 420 }} />
        </div>
      )}

      {!selected && !loading && (
        <div className="fade-up" style={{ textAlign: 'center', marginTop: 90, color: 'var(--muted)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>🧬</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Decode a player's DNA</div>
          <div style={{ maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
            Search any player to see their 8-axis performance fingerprint and their closest tactical clones.
          </div>
        </div>
      )}

      {selected && radar && !loading && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Player info + radar */}
          <div>
            {/* Header */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0, fontSize: 18, fontWeight: 800,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 20px -8px rgba(91,140,255,0.7)',
                }}>{initials(selected.player_name)}</div>
                <div>
                  <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.01em' }}>{selected.player_name}</div>
                  <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                    {selected.team} · {selected.position} · {selected.nationality}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <StatBadge label="Goals" value={selected.total_goals_tournament} color="var(--green)" />
                <StatBadge label="Assists" value={selected.total_assists_tournament} color="var(--accent)" />
                <StatBadge label="Rating" value={selected.player_rating?.toFixed(1)} color="var(--amber)" />
                <StatBadge label="Value" value={`€${(selected.market_value_eur / 1_000_000).toFixed(0)}M`} color="var(--muted)" />
              </div>
            </div>

            {/* Radar */}
            <div className="card" style={{ padding: 18 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Performance DNA</div>
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
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 4 }}>Tactical clones</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Most similar across 15 performance dimensions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {clones.map(c => <CloneCard key={c.player_id} clone={c} onSelect={selectPlayer} />)}
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div className="section-label" style={{ marginBottom: 14 }}>Advanced metrics</div>
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
