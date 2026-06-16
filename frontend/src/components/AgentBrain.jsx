import { useRef, useEffect, useState } from 'react';

const TOOL_COLOR = {
  search_players:        '#4f7ef7',
  find_clones:           '#4f7ef7',
  get_leaderboard:       '#4f7ef7',
  get_hidden_gems:       '#1fb574',
  simulate_substitution: '#1fb574',
  analyze_match:         '#f5a623',
  list_matches:          '#f5a623',
  get_player:            '#4f7ef7',
};
const EXPANDED = 220, COLLAPSED = 34;

export default function AgentBrain({ toolCalls = [], isLoading, queryText }) {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const animRef   = useRef(0);
  const startRef  = useRef(0);
  const layoutRef = useRef(null);
  const callsRef  = useRef([]);

  const [collapsed, setCollapsed] = useState(false);
  const [elapsed, setElapsed]     = useState(0);

  const uniqueTools = [...new Set(toolCalls.map(t => t.tool))];

  // reset + (re)start animation when a query begins/ends
  useEffect(() => {
    callsRef.current = uniqueTools;
    startRef.current = performance.now();
    if (isLoading) { setCollapsed(false); setElapsed(0); }
    if (!isLoading && toolCalls.length > 0) {
      const total = uniqueTools.length * 350 + 600 + 2000;
      const t = setTimeout(() => setCollapsed(true), total);
      setElapsed(Math.round(performance.now() - (window.__brainT0 || performance.now())));
      return () => clearTimeout(t);
    }
  }, [isLoading, toolCalls]);

  // record query start for elapsed display
  useEffect(() => { if (isLoading) window.__brainT0 = performance.now(); }, [isLoading]);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLayout(w, h);
    }

    function buildLayout(w, h) {
      const tools = callsRef.current;
      const orch = { x: w / 2, y: 42, r: 22 };
      const n = tools.length;
      const toolNodes = tools.map((name, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = 90 + t * (w - 180);
        return { name, x, y: 128, r: 15, color: TOOL_COLOR[name] || '#4f7ef7' };
      });
      const data = [
        { name: 'DataFrame',  x: w * 0.30, y: 196, r: 11, link: 'search_players' },
        { name: 'FAISS index', x: w * 0.70, y: 196, r: 11, link: 'find_clones' },
      ];
      layoutRef.current = { orch, toolNodes, data };
    }

    function node(x, y, r, color, label, sub, glow) {
      if (glow > 0) {
        const g = ctx.createRadialGradient(x, y, r, x, y, r + 18);
        g.addColorStop(0, color + Math.round(glow * 90).toString(16).padStart(2, '0'));
        g.addColorStop(1, color + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r + 18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b2030';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + r + 13);
      if (sub) { ctx.fillStyle = '#8a92a8'; ctx.font = '9px Inter, sans-serif'; ctx.fillText(sub, x, y + r + 24); }
      ctx.textAlign = 'left';
    }

    function draw(ts) {
      const L = layoutRef.current;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
      if (!L) { animRef.current = requestAnimationFrame(draw); return; }
      const { orch, toolNodes, data } = L;
      const t = ts - startRef.current;

      // edges orchestrator → tools
      ctx.strokeStyle = '#e0e4ee'; ctx.lineWidth = 1.4;
      for (const tn of toolNodes) {
        ctx.beginPath(); ctx.moveTo(orch.x, orch.y); ctx.lineTo(tn.x, tn.y); ctx.stroke();
      }
      // edges tool → data
      for (const d of data) {
        const tn = toolNodes.find(n => n.name === d.link);
        if (tn) { ctx.beginPath(); ctx.moveTo(tn.x, tn.y); ctx.lineTo(d.x, d.y); ctx.stroke(); }
      }

      // particles + glow
      const glowFor = {};
      toolNodes.forEach((tn, i) => {
        const startAt = i * 350;
        const p = (t - startAt) / 600;
        if (p >= 0 && p <= 1) {
          const px = orch.x + (tn.x - orch.x) * p;
          const py = orch.y + (tn.y - orch.y) * p;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 8);
          g.addColorStop(0, 'rgba(79,126,247,0.9)'); g.addColorStop(1, 'rgba(79,126,247,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
        const since = t - (startAt + 600);
        if (since >= 0 && since < 800) glowFor[i] = 1 - since / 800;
      });

      // nodes
      data.forEach(d => node(d.x, d.y, d.r, '#f5a623', d.name, '', 0));
      toolNodes.forEach((tn, i) => node(tn.x, tn.y, tn.r, tn.color, tn.name, '', glowFor[i] || 0));
      // orchestrator pulse
      const op = isLoading ? (Math.sin(ts / 300) * 0.3 + 0.5) : 0;
      node(orch.x, orch.y, orch.r, '#7c5cf6', 'Orchestrator', 'gpt-4o', op);

      animRef.current = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [isLoading, toolCalls]);

  // click a tool node → console.log last input (debug)
  function onClick(e) {
    const L = layoutRef.current; if (!L) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    for (const tn of L.toolNodes) {
      if ((tn.x - mx) ** 2 + (tn.y - my) ** 2 < (tn.r + 4) ** 2) {
        const last = [...toolCalls].reverse().find(t => t.tool === tn.name);
        // eslint-disable-next-line no-console
        console.log(`[AgentBrain] ${tn.name} input:`, last?.input);
      }
    }
  }

  return (
    <div ref={wrapRef} className="card" style={{
      margin: '0 28px 4px', overflow: 'hidden', position: 'relative',
      height: collapsed ? COLLAPSED : EXPANDED,
      transition: 'height .5s cubic-bezier(.2,.8,.2,1)',
    }}>
      {/* canvas always mounted so the animation loop never detaches */}
      <canvas ref={canvasRef} onClick={onClick} style={{
        display: 'block', width: '100%', height: '100%',
        opacity: collapsed ? 0 : 1, transition: 'opacity .3s',
      }} />

      {!collapsed && (
        <>
          <div style={{
            position: 'absolute', top: 10, left: 16, fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 7, zIndex: 2,
          }}>
            <span className="section-label">Agent reasoning</span>
            {isLoading && <span className="typing" style={{ color: 'var(--accent)' }}><span /><span /><span /></span>}
          </div>
          {!isLoading && toolCalls.length > 0 && (
            <button onClick={() => setCollapsed(true)} style={{
              position: 'absolute', top: 8, right: 12, zIndex: 2, fontSize: 11,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '4px 9px', color: 'var(--muted)',
            }}>collapse</button>
          )}
        </>
      )}

      {collapsed && (
        <button onClick={() => setCollapsed(false)} style={{
          position: 'absolute', inset: 0, width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px', background: 'transparent', border: 'none', fontSize: 12.5, color: 'var(--text2)',
        }}>
          <span style={{ color: 'var(--accent)' }}>⚡</span>
          {uniqueTools.length} tool{uniqueTools.length !== 1 ? 's' : ''} called
          <span style={{ color: 'var(--muted)' }}>· {elapsed}ms · click to expand reasoning graph</span>
        </button>
      )}
    </div>
  );
}
