import { useState, useEffect } from 'react';
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

function ProbBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ background: 'var(--surface)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.round(value * 100)}%`, height: '100%',
          background: color, borderRadius: 4, transition: 'width 0.6s ease',
        }} />
      </div>
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
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, minHeight: 500 }}>
        {/* Left: match selector */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>TOURNAMENT STAGE</div>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', color: 'var(--text)', cursor: 'pointer',
              }}
            >
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>SELECT A MATCH</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matches.slice(0, 10).map(m => (
              <div
                key={m.match_id}
                onClick={() => loadMatch(m.match_id)}
                style={{
                  background: selectedMatch === m.match_id ? 'rgba(79,126,247,0.12)' : 'var(--surface2)',
                  border: `1px solid ${selectedMatch === m.match_id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 12 }}>{m.team} vs {m.opponent}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                  {m.score} · {m.result}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: sim panel */}
        <div>
          {!matchData && !loadingMatch && (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
              <div>Pick a match to become the manager</div>
            </div>
          )}
          {loadingMatch && <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 80 }}>Loading match data...</div>}

          {matchData && !loadingMatch && (
            <div>
              {/* Match header */}
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  {matchData.tournament_stage} · {matchData.stadium}, {matchData.city}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {teamNames[0]} <span style={{ color: 'var(--muted)' }}>vs</span> {teamNames[1]}
                </div>
                <div style={{ fontSize: 18, marginTop: 4, color: 'var(--amber)' }}>
                  HT: {Math.floor(matchData.goals_team / 2)} – {Math.floor(matchData.goals_opponent / 2)}
                  <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>(simulated half-time)</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
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
                  <button
                    onClick={runSim}
                    disabled={simulating}
                    style={{
                      width: '100%', marginTop: 12, background: 'var(--accent)',
                      border: 'none', borderRadius: 10, padding: '12px',
                      color: '#fff', fontSize: 15, fontWeight: 600,
                      cursor: simulating ? 'wait' : 'pointer',
                      opacity: simulating ? 0.7 : 1, transition: 'opacity 0.15s',
                    }}
                  >
                    {simulating ? 'Running 200 simulations...' : '▶ Simulate 2nd Half'}
                  </button>
                </div>

                {/* Results panel */}
                <div>
                  {simResult ? (
                    <div style={{
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: 20,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: 'var(--muted)' }}>
                        SIMULATION RESULTS
                        <span style={{ fontSize: 11, marginLeft: 6 }}>({simResult.n_sims} runs)</span>
                      </div>
                      <ProbBar label="Win" value={simResult.win_prob} color="var(--green)" />
                      <ProbBar label="Draw" value={simResult.draw_prob} color="var(--amber)" />
                      <ProbBar label="Loss" value={simResult.loss_prob} color="var(--red)" />
                      <div style={{
                        marginTop: 16, padding: '12px', background: 'var(--surface)',
                        borderRadius: 8, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Expected goal diff</div>
                        <div style={{
                          fontSize: 24, fontWeight: 700,
                          color: simResult.expected_goal_diff > 0 ? 'var(--green)' : simResult.expected_goal_diff < 0 ? 'var(--red)' : 'var(--amber)',
                        }}>
                          {simResult.expected_goal_diff > 0 ? '+' : ''}{simResult.expected_goal_diff.toFixed(2)}
                        </div>
                      </div>
                      {subbedPlayers.size > 0 && (
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                          Substitutions boosted stamina for {subbedPlayers.size} players
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: 20, color: 'var(--muted)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                      <div style={{ fontSize: 13 }}>
                        Mark players for substitution, then run the simulation to see the outcome probability
                      </div>
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
