import { useState, useEffect } from 'react';
import SimulationStorm from './SimulationStorm';
import { api } from '../lib/api';

const STAGES = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter Finals', 'Semi Finals', 'Final'];

function PlayerRow({ player, subbed, onToggleSub, canSub }) {
  const staminaColor = player.stamina_score > 70 ? 'var(--green)' : player.stamina_score > 50 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8,
      background: subbed ? 'rgba(79,126,247,0.1)' : 'var(--surface)',
      border: `1px solid ${subbed ? 'var(--accent)' : 'var(--border)'}`,
      marginBottom: 6, transition: 'all 0.15s',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: subbed ? 600 : 400, color: subbed ? 'var(--accent)' : 'var(--text)' }}>
          {player.player_name}
          {subbed && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}>↔ SUBBED</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{player.position}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 50 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Stamina</div>
        <div style={{ fontWeight: 600, color: staminaColor }}>{player.stamina_score?.toFixed(0)}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 44 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Rating</div>
        <div style={{ fontWeight: 600 }}>{player.player_rating?.toFixed(1)}</div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 32 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>G</div>
        <div style={{ fontWeight: 600 }}>{player.goals}</div>
      </div>
      <button
        disabled={!canSub && !subbed}
        onClick={() => onToggleSub(player)}
        style={{
          background: subbed ? 'var(--accent)' : 'transparent',
          border: `1px solid ${subbed ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 6, padding: '4px 10px', fontSize: 11,
          color: subbed ? '#fff' : 'var(--muted)',
          cursor: (!canSub && !subbed) ? 'not-allowed' : 'pointer',
          opacity: (!canSub && !subbed) ? 0.4 : 1,
          transition: 'all 0.15s',
        }}
      >
        {subbed ? 'Undo' : 'Sub'}
      </button>
    </div>
  );
}

export default function ManagerSim() {
  const [stage, setStage] = useState('Semi Finals');
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [subbedPlayers, setSubbedPlayers] = useState(new Set());
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const MAX_SUBS = 3;

  useEffect(() => {
    api.listMatches({ stage, limit: 12 }).then(setMatches);
    setSelectedMatch(null);
    setMatchData(null);
    setSimResult(null);
    setSubbedPlayers(new Set());
  }, [stage]);

  async function loadMatch(matchId) {
    setLoadingMatch(true);
    setSimResult(null);
    setSubbedPlayers(new Set());
    try {
      const data = await api.getMatch(matchId);
      setMatchData(data);
      setSelectedMatch(matchId);
    } finally {
      setLoadingMatch(false);
    }
  }

  function toggleSub(player) {
    setSubbedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(player.player_id)) {
        next.delete(player.player_id);
      } else if (next.size < MAX_SUBS) {
        next.add(player.player_id);
      }
      return next;
    });
    setSimResult(null);
  }

  async function runSim() {
    if (!matchData) return;
    setSimulating(true);
    try {
      // Get the first team's players
      const teamName = Object.keys(matchData.teams)[0];
      const players = matchData.teams[teamName];
      const subbedIndices = players
        .map((p, i) => subbedPlayers.has(p.player_id) ? i : -1)
        .filter(i => i >= 0);

      const result = await api.simulate({
        team_players: players,
        sub_indices: subbedIndices,
        team_goals_ht: Math.floor(matchData.goals_team / 2),
        opp_goals_ht: Math.floor(matchData.goals_opponent / 2),
      });
      setSimResult(result);
    } finally {
      setSimulating(false);
    }
  }

  const teamNames = matchData ? Object.keys(matchData.teams) : [];
  const teamName = teamNames[0];
  const players = matchData ? matchData.teams[teamName] || [] : [];

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 20, minHeight: 500 }}>
        {/* Left: match selector */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 7 }}>Tournament stage</div>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="focus-ring"
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px', color: 'var(--text)', cursor: 'pointer',
                transition: 'border-color .15s, box-shadow .15s',
              }}
            >
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="section-label" style={{ marginBottom: 9 }}>Select a match</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {matches.slice(0, 10).map(m => {
              const on = selectedMatch === m.match_id;
              return (
                <div key={m.match_id} onClick={() => loadMatch(m.match_id)} className="hover-lift" style={{
                  background: on ? 'linear-gradient(120deg, rgba(91,140,255,0.14), rgba(139,92,246,0.08))' : 'var(--surface2)',
                  border: `1px solid ${on ? 'rgba(91,140,255,0.4)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '11px 13px', cursor: 'pointer',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.team} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>vs</span> {m.opponent}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 3 }}>{m.score} · {m.result}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: sim panel */}
        <div>
          {!matchData && !loadingMatch && (
            <div className="fade-up" style={{ textAlign: 'center', marginTop: 90, color: 'var(--muted)' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              }}>🎮</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Take the dugout</div>
              <div style={{ maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
                Pick a match, make up to 3 substitutions, then run 200 Monte Carlo simulations of the second half.
              </div>
            </div>
          )}
          {loadingMatch && <div className="skeleton" style={{ height: 460, marginTop: 4 }} />}

          {matchData && !loadingMatch && (
            <div className="fade-up">
              {/* Match header */}
              <div className="card" style={{ padding: 18, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, letterSpacing: '.03em' }}>
                  {matchData.tournament_stage} · {matchData.stadium}, {matchData.city}
                </div>
                <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-.01em' }}>
                  {teamNames[0]} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 18 }}>vs</span> {teamNames[1]}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10,
                  background: 'rgba(255,177,61,0.1)', border: '1px solid rgba(255,177,61,0.25)',
                  borderRadius: 999, padding: '5px 14px',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {Math.floor(matchData.goals_team / 2)} – {Math.floor(matchData.goals_opponent / 2)}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>half-time</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Players */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 10,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {teamName} — Half-time squad
                    </div>
                    <div style={{ fontSize: 12, color: subbedPlayers.size >= MAX_SUBS ? 'var(--red)' : 'var(--muted)' }}>
                      {subbedPlayers.size}/{MAX_SUBS} subs used
                    </div>
                  </div>
                  {players.slice(0, 14).map(p => (
                    <PlayerRow
                      key={p.player_id}
                      player={p}
                      subbed={subbedPlayers.has(p.player_id)}
                      onToggleSub={toggleSub}
                      canSub={subbedPlayers.size < MAX_SUBS}
                    />
                  ))}
                  <button onClick={runSim} disabled={simulating} className="btn-primary" style={{
                    width: '100%', marginTop: 14, padding: '13px', fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    {simulating
                      ? <>Running 200 simulations <span className="typing"><span /><span /><span /></span></>
                      : '▶ Simulate 2nd Half'}
                  </button>
                </div>

                {/* Results panel — SimulationStorm */}
                <div>
                  <SimulationStorm simResult={simResult} isSimulating={simulating} />
                  {simResult && subbedPlayers.size > 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                      Substitutions boosted stamina for {subbedPlayers.size} player{subbedPlayers.size !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
