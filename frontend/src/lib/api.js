const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  health: () => req('/health'),

  // Players
  searchPlayers: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && q.set(k, v));
    return req(`/players?${q}`);
  },
  getPlayer:  (id) => req(`/players/${id}`),
  getRadar:   (id) => req(`/players/${id}/radar`),
  getClones:  (id, k = 5) => req(`/players/${id}/clones?k=${k}`),

  // Leaderboard
  leaderboard: (metric = 'total_goals_tournament', limit = 20) =>
    req(`/leaderboard?metric=${metric}&limit=${limit}`),

  // Matches
  listMatches: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && q.set(k, v));
    return req(`/matches?${q}`);
  },
  getMatch: (id) => req(`/matches/${id}`),

  // Value scatter
  scatter: () => req('/scatter'),

  // Embedding universe (PCA 2D)
  embeddings: () => req('/embeddings'),

  // Simulation
  simulate: (body) => req('/simulate', { method: 'POST', body: JSON.stringify(body) }),

  // Agent chat
  chat: (messages) => req('/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
};
