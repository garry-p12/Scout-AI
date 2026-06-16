import { useRef, useEffect, useState } from 'react';
import { api } from '../lib/api';

const POS_COLORS = {
  Forward:    '#f5a623',
  Midfielder: '#4f7ef7',
  Defender:   '#1fb574',
  Goalkeeper: '#7c5cf6',
};
const PAD = 44;

export default function PlayerUniverse({ onPlayerSelect, highlightIds = [] }) {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const dataRef   = useRef([]);          // raw players w/ x,y
  const ptsRef    = useRef([]);          // players w/ screen px {sx, sy, r}
  const hoverRef  = useRef(null);
  const highlightRef = useRef(new Set());
  const searchRef = useRef('');
  const sizeRef   = useRef({ w: 0, h: 0 });
  const animRef   = useRef(0);

  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);   // {x, y, p}
  const [search, setSearch]   = useState('');

  useEffect(() => { highlightRef.current = new Set(highlightIds); }, [highlightIds]);
  useEffect(() => { searchRef.current = search.trim().toLowerCase(); }, [search]);

  // ── fetch once ──────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    api.embeddings().then(d => {
      if (!alive) return;
      dataRef.current = d;
      setLoading(false);
      layout();
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  // ── compute screen positions ────────────────────────────
  function layout() {
    const data = dataRef.current;
    const { w, h } = sizeRef.current;
    if (!data.length || !w || !h) return;
    const xs = data.map(p => p.x), ys = data.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = v => PAD + (v - minX) / (maxX - minX || 1) * (w - PAD * 2);
    const sy = v => PAD + (v - minY) / (maxY - minY || 1) * (h - PAD * 2);

    // top 20 by rating get labels + bigger dots
    const ranked = [...data].sort((a, b) => b.player_rating - a.player_rating);
    const named = new Set(ranked.slice(0, 20).map(p => p.player_id));

    ptsRef.current = data.map(p => ({
      ...p, sx: sx(p.x), sy: sy(p.y),
      r: named.has(p.player_id) ? 5 : 3,
      named: named.has(p.player_id),
    }));
  }

  // ── animation loop ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    let t0 = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      sizeRef.current = { w, h };
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
    }

    function draw(ts) {
      if (!t0) t0 = ts;
      const { w, h } = sizeRef.current;
      const pts = ptsRef.current;
      ctx.clearRect(0, 0, w, h);
      if (!pts.length) { animRef.current = requestAnimationFrame(draw); return; }

      const pulse = Math.sin(ts / 1000 * (Math.PI * 2 / 3)) * 0.5; // ±0.5px, ~3s
      const hl = highlightRef.current;
      const hasHL = hl.size > 0;
      const q = searchRef.current;
      const hover = hoverRef.current;

      // connection lines: highlighted clones → centre (first id)
      if (hasHL) {
        const ids = [...hl];
        const centre = pts.find(p => p.player_id === ids[0]);
        if (centre) {
          ctx.strokeStyle = 'rgba(79,126,247,0.35)';
          ctx.lineWidth = 1;
          for (const id of ids.slice(1)) {
            const p = pts.find(x => x.player_id === id);
            if (!p) continue;
            ctx.beginPath();
            ctx.moveTo(centre.sx, centre.sy);
            ctx.lineTo(p.sx, p.sy);
            ctx.stroke();
          }
        }
      }

      // dots
      for (const p of pts) {
        const matchSearch = !q || p.player_name.toLowerCase().includes(q);
        const isHL = hl.has(p.player_id);
        let alpha = 1;
        if (hasHL && !isHL) alpha = 0.18;
        if (q && !matchSearch) alpha = 0.10;

        const r = p.r + pulse + (p.named ? 0.4 : 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = POS_COLORS[p.position] || '#8a92a8';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();

        if (isHL) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = POS_COLORS[p.position] || '#8a92a8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r + 4.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // labels for named players
        if (p.named && alpha > 0.5) {
          ctx.globalAlpha = hasHL && !isHL ? 0.25 : 0.7;
          ctx.fillStyle = '#515a72';
          ctx.font = '10px Inter, sans-serif';
          ctx.fillText(p.player_name, p.sx + 7, p.sy + 3);
        }
      }

      // hover ring
      if (hover) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = POS_COLORS[hover.position] || '#8a92a8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hover.sx, hover.sy, hover.r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  // ── pointer interaction ─────────────────────────────────
  function nearest(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 12 * 12;
    for (const p of ptsRef.current) {
      const d = (p.sx - mx) ** 2 + (p.sy - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return { best, mx, my };
  }

  function onMove(e) {
    const { best, mx, my } = nearest(e);
    hoverRef.current = best;
    canvasRef.current.style.cursor = best ? 'pointer' : 'default';
    setTooltip(best ? { x: mx, y: my, p: best } : null);
  }

  function onClick(e) {
    const { best } = nearest(e);
    if (best && onPlayerSelect) onPlayerSelect(best.player_id);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => { hoverRef.current = null; setTooltip(null); }}
        onClick={onClick}
        style={{ display: 'block', width: '100%', height: '100%' }} />

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          Mapping the player universe…
        </div>
      )}

      {/* search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter players…"
        className="focus-ring"
        style={{
          position: 'absolute', top: 12, right: 12, width: 180,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 9, padding: '7px 12px', fontSize: 12.5, color: 'var(--text)',
          outline: 'none', boxShadow: 'var(--shadow)',
        }}
      />

      {/* legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 14,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow)',
      }}>
        {Object.entries(POS_COLORS).map(([pos, c]) => (
          <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
            {pos}
          </div>
        ))}
      </div>

      {/* tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x + 14, (wrapRef.current?.offsetWidth || 999) - 180),
          top: tooltip.y + 14, pointerEvents: 'none', zIndex: 5,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 13px', boxShadow: 'var(--shadow-lg)', minWidth: 150,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{tooltip.p.player_name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 1 }}>{tooltip.p.team} · {tooltip.p.position}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 7, fontSize: 12 }}>
            <span>⚽ {tooltip.p.total_goals_tournament}</span>
            <span>⭐ {tooltip.p.player_rating}</span>
          </div>
        </div>
      )}
    </div>
  );
}
