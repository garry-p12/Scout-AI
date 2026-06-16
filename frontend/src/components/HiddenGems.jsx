import { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../lib/api';

const METRICS = [
  { key: 'total_goals_tournament',    label: 'Tournament Goals' },
  { key: 'total_assists_tournament',  label: 'Tournament Assists' },
  { key: 'tournament_rating',         label: 'Tournament Rating' },
  { key: 'creativity_score',          label: 'Creativity Score' },
  { key: 'clutch_performance_score',  label: 'Clutch Score' },
  { key: 'player_rating',             label: 'Player Rating' },
];

const POSITION_COLORS = {
  Forward:    '#f5a623',
  Midfielder: '#4f7ef7',
  Defender:   '#3dd68c',
  Goalkeeper: '#a78bf5',
};

function GemCard({ player, rank }) {
  const valueM = (player.value_m || 0).toFixed(1);
  return (
    <div className="card hover-lift" style={{
      padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: rank <= 3 ? 'rgba(245,166,35,0.2)' : 'var(--surface)',
        border: `1px solid ${rank <= 3 ? 'var(--amber)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13,
        color: rank <= 3 ? 'var(--amber)' : 'var(--muted)',
      }}>#{rank}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{player.player_name}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
          {player.team} · {player.position}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: 12 }}>
          <span style={{
            background: 'rgba(61,214,140,0.12)', color: 'var(--green)',
            borderRadius: 5, padding: '2px 7px',
          }}>
            ⚽ {player.total_goals_tournament}g
          </span>
          <span style={{
            background: 'rgba(79,126,247,0.12)', color: 'var(--accent)',
            borderRadius: 5, padding: '2px 7px',
          }}>
            ⭐ {player.player_rating?.toFixed(1)}
          </span>
          <span style={{ color: 'var(--muted)' }}>€{valueM}M</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Gem score</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
          +{player.gem_score?.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  const color = POSITION_COLORS[payload.position] || '#888';
  return (
    <circle
      cx={cx} cy={cy} r={payload.gem_score > 1 ? 6 : 4}
      fill={color} fillOpacity={0.7}
      stroke={payload.gem_score > 1.5 ? '#fff' : 'none'}
      strokeWidth={1}
    />
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.player_name}</div>
      <div style={{ color: 'var(--muted)' }}>{d.team} · {d.position}</div>
      <div style={{ marginTop: 6 }}>Perf: <strong>{d.perf_score?.toFixed(1)}</strong></div>
      <div>Value: <strong>€{d.value_m?.toFixed(1)}M</strong></div>
      <div>Gem: <strong style={{ color: 'var(--green)' }}>{d.gem_score?.toFixed(2)}</strong></div>
    </div>
  );
};

export default function HiddenGems() {
  const [scatter, setScatter] = useState([]);
  const [gems, setGems]       = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [metric, setMetric]   = useState('total_goals_tournament');
  const [posFilter, setPosFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.scatter(), api.leaderboard(metric)]).then(([sc, lb]) => {
      setScatter(sc);
      const sorted = [...sc].sort((a, b) => b.gem_score - a.gem_score);
      setGems(sorted.slice(0, 10));
      setLeaders(lb);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    api.leaderboard(metric, 15).then(setLeaders);
  }, [metric]);

  const filtered = posFilter === 'All'
    ? scatter
    : scatter.filter(p => p.position === posFilter);

  if (loading) return (
    <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="skeleton" style={{ height: 360 }} />
        <div className="skeleton" style={{ height: 360 }} />
      </div>
    </div>
  );

  const topGem = gems[0];
  const avgGoals = scatter.length ? (scatter.reduce((s, p) => s + (p.total_goals_tournament || 0), 0) / scatter.length).toFixed(1) : '0';

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', maxWidth: 1180, margin: '0 auto' }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Players analysed', value: scatter.length.toLocaleString(), accent: 'var(--accent)' },
          { label: 'Top gem', value: topGem?.player_name || '—', accent: 'var(--green)', small: true },
          { label: 'Best gem score', value: topGem ? `+${topGem.gem_score?.toFixed(2)}` : '—', accent: 'var(--green)' },
          { label: 'Avg goals / player', value: avgGoals, accent: 'var(--amber)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 16px' }}>
            <div className="section-label" style={{ marginBottom: 7 }}>{k.label}</div>
            <div style={{
              fontSize: k.small ? 15 : 22, fontWeight: 800, color: k.accent, letterSpacing: '-.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Scatter chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 500 }}>Value vs Performance</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Players above the trend line are undervalued
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['All', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper'].map(p => (
                <button
                  key={p}
                  onClick={() => setPosFilter(p)}
                  style={{
                    background: posFilter === p ? 'var(--accent)' : 'var(--surface)',
                    border: `1px solid ${posFilter === p ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6, padding: '3px 8px', fontSize: 11,
                    color: posFilter === p ? '#fff' : 'var(--muted)',
                    cursor: 'pointer',
                  }}
                >{p === 'All' ? p : p[0]}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis
                dataKey="value_m" name="Market Value (€M)"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                label={{ value: 'Market Value (€M)', position: 'insideBottom', offset: -2, fill: 'var(--muted)', fontSize: 11 }}
              />
              <YAxis
                dataKey="perf_score" name="Performance Score"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                label={{ value: 'Performance', angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={filtered} shape={<CustomDot />} />
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(POSITION_COLORS).map(([pos, color]) => (
              <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                {pos}
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 500 }}>Leaderboard</div>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '4px 8px', color: 'var(--text)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            {leaders.map((p, i) => (
              <div key={p.player_id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 22, textAlign: 'center', fontWeight: 700, fontSize: 12,
                  color: i < 3 ? 'var(--amber)' : 'var(--muted)',
                }}>{i + 1}</div>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: POSITION_COLORS[p.position] || '#888',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.player_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.team}</div>
                </div>
                <div style={{
                  fontWeight: 700, fontSize: 15,
                  color: i === 0 ? 'var(--amber)' : 'var(--text)',
                }}>
                  {typeof p.value === 'number'
                    ? (p.value % 1 === 0 ? p.value : p.value.toFixed(1))
                    : p.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden Gems list */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>💎 Hidden Gems</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          Highest performance relative to market value — the players your rivals haven't noticed
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {gems.map((p, i) => <GemCard key={p.player_id} player={p} rank={i + 1} />)}
        </div>
      </div>
    </div>
  );
}
