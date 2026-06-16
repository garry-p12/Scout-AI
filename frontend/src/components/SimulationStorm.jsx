// frontend/src/components/SimulationStorm.jsx

import { useEffect, useRef, useCallback } from 'react';
import {
  Chart,
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale,
  ChartTooltip,
);

// ── Colour constants (light theme — matches the app shell) ─────────────────
const C = {
  bg:      '#ffffff',
  surface: '#f7f9fc',
  card:    '#f4f6fb',
  border:  '#e4e8f0',
  text:    '#1b2030',
  muted:   '#8a92a8',
  dim:     '#aab0c2',
  green:   '#1fb574',
  amber:   '#f5a623',
  red:     '#ef4d4d',
  blue:    '#4f7ef7',
};
const GRID  = 'rgba(20,30,60,0.07)';
const GRID2 = 'rgba(20,30,60,0.04)';

// ── Tiny helper: destroy a chart ref safely ────────────────────────────────
function destroyChart(ref) {
  if (ref.current) { ref.current.destroy(); ref.current = null; }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SimulationStorm({ simResult, isSimulating }) {

  // Canvas refs
  const stormRef  = useRef(null);   // trajectory canvas
  const sdistRef  = useRef(null);   // score distribution canvas
  const stamRef   = useRef(null);   // stamina curve canvas

  // Chart.js instance refs
  const sdistChart = useRef(null);
  const stamChart  = useRef(null);

  // Animation frame ref for trajectory canvas
  const rafRef = useRef(null);

  // ── Draw trajectory storm ───────────────────────────────────────────────
  const drawStorm = useCallback((timelines, teamGoalsHT, oppGoalsHT) => {
    const canvas = stormRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Layout constants
    const LEFT  = 42;
    const RIGHT = W - 12;
    const YPAD  = 18;
    const YMIN  = YPAD;
    const YMAX  = H - YPAD;

    // y maps goal-differential to canvas y. We show diffs from -3 to +3
    const DIFF_MIN = -3, DIFF_MAX = 3;
    function yAt(tg, og) {
      const d = Math.max(DIFF_MIN, Math.min(DIFF_MAX, tg - og));
      return YMIN + (YMAX - YMIN) * (1 - (d - DIFF_MIN) / (DIFF_MAX - DIFF_MIN));
    }

    // x maps tick index (0–8) to canvas x
    const TICKS = 9;
    function xAt(i) { return LEFT + (i / (TICKS - 1)) * (RIGHT - LEFT); }

    // Pre-assign each timeline a random alpha and width once
    const meta = timelines.map(() => ({
      alpha: 0.13 + Math.random() * 0.10,
      width: 0.5 + Math.random() * 0.5,
      delay: Math.floor(Math.random() * 90),
      speed: 0.014 + Math.random() * 0.014,
      progress: 0,
    }));

    let frame = 0;

    function tick() {
      frame++;

      // Semi-transparent white clear for motion-blur trail
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(0, 0, W, H);

      // Grid lines (one per integer diff)
      for (let d = DIFF_MIN; d <= DIFF_MAX; d++) {
        const y = yAt(teamGoalsHT + d, oppGoalsHT + d);
        ctx.beginPath();
        ctx.moveTo(LEFT, y);
        ctx.lineTo(RIGHT, y);
        ctx.strokeStyle = d === 0 ? 'rgba(120,130,160,0.55)' : GRID;
        ctx.lineWidth   = d === 0 ? 0.9 : 0.5;
        ctx.stroke();

        // Axis labels
        if (d !== 0) {
          ctx.fillStyle = C.dim;
          ctx.font      = '8px Inter,-apple-system,sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(d > 0 ? `+${d}` : `${d}`, LEFT - 4, y + 3);
        }
      }

      // HT marker
      ctx.beginPath();
      ctx.moveTo(LEFT, YMIN);
      ctx.lineTo(LEFT, YMAX);
      ctx.strokeStyle = 'rgba(79,126,247,0.4)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.blue;
      ctx.font      = '8px Inter,-apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("HT", LEFT, YMIN - 5);

      // Minute labels on x-axis
      const MINUTES = [46, 51, 56, 61, 66, 71, 76, 81, 86];
      ctx.fillStyle = C.dim;
      ctx.font      = '8px Inter,-apple-system,sans-serif';
      ctx.textAlign = 'center';
      MINUTES.forEach((m, i) => ctx.fillText(`${m}'`, xAt(i), H - 3));

      // Trajectories
      let allDone = 0;
      timelines.forEach((tl, i) => {
        const m = meta[i];
        if (frame < m.delay) return;
        m.progress = Math.min(1, m.progress + m.speed);
        if (m.progress >= 1) allDone++;

        const last = tl[tl.length - 1];
        const col = last.tg > last.og
          ? `rgba(31,181,116,${m.alpha})`
          : last.tg === last.og
            ? `rgba(245,166,35,${m.alpha})`
            : `rgba(239,77,77,${m.alpha})`;

        ctx.beginPath();
        ctx.moveTo(xAt(0), yAt(teamGoalsHT, oppGoalsHT));

        const totalSteps  = tl.length;
        const drawUpTo    = m.progress * totalSteps;
        const fullSteps   = Math.floor(drawUpTo);
        const frac        = drawUpTo - fullSteps;

        for (let s = 0; s < fullSteps && s < totalSteps; s++) {
          ctx.lineTo(xAt(s), yAt(tl[s].tg, tl[s].og));
        }
        // Interpolate the partial step
        if (fullSteps < totalSteps && frac > 0) {
          const prev = fullSteps === 0
            ? { tg: teamGoalsHT, og: oppGoalsHT }
            : tl[fullSteps - 1];
          const next = tl[fullSteps];
          ctx.lineTo(
            xAt(fullSteps - 1 + frac),
            yAt(
              prev.tg + (next.tg - prev.tg) * frac,
              prev.og + (next.og - prev.og) * frac,
            ),
          );
        }

        ctx.strokeStyle = col;
        ctx.lineWidth   = m.width;
        ctx.stroke();
      });

      if (allDone < timelines.length) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Draw score distribution bar chart ──────────────────────────────────
  const drawScoreDist = useCallback((topScores) => {
    destroyChart(sdistChart);
    const canvas = sdistRef.current;
    if (!canvas) return;

    sdistChart.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: topScores.map(([score]) => score),
        datasets: [{
          data: topScores.map(([, count]) => count),
          backgroundColor: topScores.map(([score]) => {
            const [tg, og] = score.split('-').map(Number);
            return tg > og
              ? 'rgba(31,181,116,0.55)'
              : tg === og
                ? 'rgba(245,166,35,0.55)'
                : 'rgba(239,77,77,0.55)';
          }),
          borderColor: topScores.map(([score]) => {
            const [tg, og] = score.split('-').map(Number);
            return tg > og ? C.green : tg === og ? C.amber : C.red;
          }),
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.raw} sims` } },
        },
        scales: {
          x: {
            ticks:  { color: C.muted, font: { size: 10 } },
            grid:   { color: GRID },
            border: { color: C.border },
          },
          y: {
            ticks:  { color: C.muted, font: { size: 9 } },
            grid:   { color: GRID2 },
            border: { color: C.border },
          },
        },
      },
    });
  }, []);

  // ── Draw stamina curve line chart ───────────────────────────────────────
  const drawStamina = useCallback((stamByMin) => {
    destroyChart(stamChart);
    const canvas = stamRef.current;
    if (!canvas) return;

    const minutes = Object.keys(stamByMin).map(Number).sort((a, b) => a - b);
    const values  = minutes.map(m => stamByMin[m]);

    stamChart.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: minutes.map(m => `${m}'`),
        datasets: [{
          data: values,
          borderColor:     C.blue,
          backgroundColor: 'rgba(79,126,247,0.10)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: C.blue,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks:  { color: C.muted, font: { size: 9 } },
            grid:   { display: false },
            border: { color: C.border },
          },
          y: {
            min: 55, max: 95,
            ticks:  { color: C.muted, font: { size: 9 }, callback: v => v.toFixed(0) },
            grid:   { color: GRID2 },
            border: { color: C.border },
          },
        },
      },
    });
  }, []);

  // ── Effect: render everything when simResult arrives ────────────────────
  useEffect(() => {
    if (!simResult?.timelines) return;

    const { timelines, top_scores, goals_by_min, stam_by_min } = simResult;

    // Recover HT score from the first timeline's first tick (PITFALL 4)
    const teamGoalsHT = timelines[0][0].tg - timelines[0][0].sc;
    const oppGoalsHT  = timelines[0][0].og - timelines[0][0].cc;

    drawStorm(timelines, teamGoalsHT, oppGoalsHT);
    drawScoreDist(top_scores);
    drawStamina(stam_by_min);

    // Populate goals-by-minute strip
    const strip = document.getElementById('sim-minstrip');
    if (strip) {
      strip.innerHTML = '';
      const minutes = Object.keys(goals_by_min).map(Number).sort((a, b) => a - b);
      const maxG = Math.max(...minutes.map(m =>
        Math.max(goals_by_min[m].sc, goals_by_min[m].cc)
      )) || 1;
      minutes.forEach(m => {
        const sc = goals_by_min[m].sc;
        const cc = goals_by_min[m].cc;
        const scH = Math.round((sc / maxG) * 26);
        const ccH = Math.round((cc / maxG) * 26);
        const col = document.createElement('div');
        col.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:2px';
        col.innerHTML = `
          <div style="width:100%;display:flex;flex-direction:column;gap:1px">
            <div style="height:${scH}px;background:${C.green};border-radius:2px 2px 0 0;opacity:0.8;min-height:2px"></div>
            <div style="height:${ccH}px;background:${C.red};border-radius:0 0 2px 2px;opacity:0.8;min-height:2px"></div>
          </div>
          <div style="font-size:8px;color:${C.dim};text-align:center;margin-top:2px">${m}'</div>
        `;
        strip.appendChild(col);
      });
      // Legend
      const leg = document.createElement('div');
      leg.style.cssText = 'display:flex;flex-direction:column;gap:3px;padding-bottom:14px;margin-left:6px;flex-shrink:0';
      leg.innerHTML = `
        <div style="display:flex;align-items:center;gap:3px;font-size:8px;color:${C.muted}">
          <div style="width:7px;height:4px;background:${C.green};border-radius:1px"></div>Scored
        </div>
        <div style="display:flex;align-items:center;gap:3px;font-size:8px;color:${C.muted}">
          <div style="width:7px;height:4px;background:${C.red};border-radius:1px"></div>Conceded
        </div>
      `;
      strip.appendChild(leg);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [simResult, drawStorm, drawScoreDist, drawStamina]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      destroyChart(sdistChart);
      destroyChart(stamChart);
    };
  }, []);

  // ── Derived summary numbers ─────────────────────────────────────────────
  const N = simResult?.n_sims ?? 200;
  const winPct  = simResult ? Math.round(simResult.win_prob  * 100) : 0;
  const drawPct = simResult ? Math.round(simResult.draw_prob * 100) : 0;
  const lossPct = simResult ? Math.round(simResult.loss_prob * 100) : 0;
  const avgDiff = simResult?.expected_goal_diff ?? 0;
  const diffColor = avgDiff > 0 ? C.green : avgDiff < 0 ? C.red : C.amber;

  // ── Styles (inline) ─────────────────────────────────────────────────────
  const s = {
    shell: {
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
      overflow: 'hidden', boxShadow: 'var(--shadow)',
      fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    },
    topbar: {
      padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
      background: C.surface, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
    },
    body: { display: 'grid', gridTemplateColumns: '1fr 180px' },
    left: { borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' },
    stormWrap: { position: 'relative', height: 210 },
    stormCanvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    lowerPanels: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${C.border}` },
    panel: { padding: '10px 12px', borderRight: `1px solid ${C.border}` },
    panelLast: { padding: '10px 12px' },
    panelLabel: { fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
    chartWrap: { position: 'relative', height: 80 },
    minStrip: { borderTop: `1px solid ${C.border}`, padding: '6px 12px 8px', display: 'flex', gap: 5, alignItems: 'flex-end' },
    right: { padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
    outcomeBlock: { background: C.card, borderRadius: 8, padding: '9px 11px' },
    obPct: { fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
    obLabel: { fontSize: 10, color: C.muted, marginTop: 2, marginBottom: 5 },
    obTrack: { height: 4, background: C.border, borderRadius: 2 },
    gdBox: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px', textAlign: 'center' },
    gdNum: { fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
    gdLabel: { fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 },
    statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 },
    statCell: { background: C.card, borderRadius: 6, padding: '6px 8px', textAlign: 'center' },
    statNum: { fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1 },
    statLabel: { fontSize: 8, color: C.dim, marginTop: 2 },
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (isSimulating) {
    return (
      <div style={{ ...s.shell, padding: 24, textAlign: 'center', color: C.muted }}>
        <div style={{ fontSize: 13, marginBottom: 8, color: C.text, fontWeight: 600 }}>Running 200 simulations…</div>
        <div style={{ fontSize: 11, color: C.dim }}>
          Building parallel futures · applying PPO-calibrated goal probabilities
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!simResult) {
    return (
      <div style={{ ...s.shell, padding: 24, textAlign: 'center', color: C.muted }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>&#9654;</div>
        <div style={{ fontSize: 13 }}>
          Mark subs then hit Simulate to see 200 parallel futures
        </div>
      </div>
    );
  }

  // ── Full dashboard ──────────────────────────────────────────────────────
  return (
    <div style={s.shell} className="pop">
      {/* Topbar */}
      <div style={s.topbar}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Simulation storm</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
            {N} parallel second-half timelines &middot; PPO goal model
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{N}</div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>sims run</div>
        </div>
      </div>

      <div style={s.body}>
        {/* Left column */}
        <div style={s.left}>
          <div style={s.stormWrap}>
            <canvas ref={stormRef} style={s.stormCanvas} />
          </div>

          <div style={s.lowerPanels}>
            <div style={s.panel}>
              <div style={s.panelLabel}>Final score distribution</div>
              <div style={s.chartWrap}><canvas ref={sdistRef} /></div>
            </div>
            <div style={s.panelLast}>
              <div style={s.panelLabel}>Avg stamina collapse</div>
              <div style={s.chartWrap}><canvas ref={stamRef} /></div>
            </div>
          </div>

          <div id="sim-minstrip" style={s.minStrip} />
        </div>

        {/* Right column */}
        <div style={s.right}>
          <div style={s.outcomeBlock}>
            <div style={{ ...s.obPct, color: C.green }}>{winPct}%</div>
            <div style={s.obLabel}>Win</div>
            <div style={s.obTrack}>
              <div style={{ height: 4, width: `${winPct}%`, background: C.green, borderRadius: 2, transition: 'width 1s ease' }} />
            </div>
          </div>
          <div style={s.outcomeBlock}>
            <div style={{ ...s.obPct, color: C.amber }}>{drawPct}%</div>
            <div style={s.obLabel}>Draw</div>
            <div style={s.obTrack}>
              <div style={{ height: 4, width: `${drawPct}%`, background: C.amber, borderRadius: 2, transition: 'width 1s ease' }} />
            </div>
          </div>
          <div style={s.outcomeBlock}>
            <div style={{ ...s.obPct, color: C.red }}>{lossPct}%</div>
            <div style={s.obLabel}>Loss</div>
            <div style={s.obTrack}>
              <div style={{ height: 4, width: `${lossPct}%`, background: C.red, borderRadius: 2, transition: 'width 1s ease' }} />
            </div>
          </div>
          <div style={s.gdBox}>
            <div style={{ ...s.gdNum, color: diffColor }}>
              {avgDiff >= 0 ? '+' : ''}{avgDiff.toFixed(2)}
            </div>
            <div style={s.gdLabel}>Expected &Delta; goals</div>
          </div>
          <div style={s.statsGrid}>
            <div style={s.statCell}>
              <div style={s.statNum}>{simResult.lead_changes}</div>
              <div style={s.statLabel}>Lead changes</div>
            </div>
            <div style={s.statCell}>
              <div style={s.statNum}>{simResult.goal_fests}</div>
              <div style={s.statLabel}>Goal-fests (&ge;4)</div>
            </div>
            <div style={s.statCell}>
              <div style={s.statNum}>{simResult.clean_sheets}</div>
              <div style={s.statLabel}>Clean sheets</div>
            </div>
            <div style={s.statCell}>
              <div style={s.statNum}>{simResult.avg_goals_per_game?.toFixed(1)}</div>
              <div style={s.statLabel}>Avg goals/game</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
