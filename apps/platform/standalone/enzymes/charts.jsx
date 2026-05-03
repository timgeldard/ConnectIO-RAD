/* Charts — minimal SVG visualisations.
   Bottleneck strip, sensitivity curve, mini sparklines. */

const SensitivityChart = ({ width = 380, height = 120 }) => {
  // Mock: cost (€) vs side α-amylase ceiling (%)
  // X: 18..28, Y: 17400..18800
  const W = width, H = height, pad = { l: 40, r: 12, t: 12, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const points = [
    { x: 18, y: 18720, feasible: false },
    { x: 19, y: 18510, feasible: false },
    { x: 20, y: 18290, feasible: true  },
    { x: 21, y: 18170, feasible: true  },
    { x: 22, y: 18055, feasible: true  },
    { x: 23, y: 17985, feasible: true  },  // ← optimum at the binding edge
    { x: 24, y: 17970, feasible: true  },
    { x: 25, y: 17960, feasible: true  },
    { x: 26, y: 17955, feasible: true  },  // diminishing returns
    { x: 27, y: 17952, feasible: true  },
    { x: 28, y: 17950, feasible: true  },
  ];

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = 17800, yMax = 18800;
  const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

  const optX = 23, optY = 17985;       // current optimum
  const userX = 25;                    // hover position
  const userY = 17960;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cost vs side-activity ceiling">
      {/* y gridlines */}
      {[18000, 18200, 18400, 18600, 18800].map(g => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(g)} y2={sy(g)} stroke="#E5E5D8" />
          <text x={pad.l - 6} y={sy(g)} textAnchor="end" fontSize="9" fontFamily="IBM Plex Mono" fill="#5d6f53" dy="3">€{(g/1000).toFixed(1)}k</text>
        </g>
      ))}

      {/* Infeasible band */}
      <rect x={sx(18)} y={pad.t} width={sx(20) - sx(18)} height={innerH}
            fill="#F24A00" opacity="0.07" />
      <text x={sx(19)} y={pad.t + 12} textAnchor="middle" fontSize="9"
            fontFamily="IBM Plex Mono" fill="#8B2900" letterSpacing=".08em">INFEASIBLE</text>

      {/* curve */}
      <path d={path} fill="none" stroke="#005776" strokeWidth="2" />

      {/* current optimum marker */}
      <circle cx={sx(optX)} cy={sy(optY)} r="5" fill="#DFFF11" stroke="#143700" strokeWidth="1.5" />
      <line x1={sx(optX)} y1={sy(optY) + 6} x2={sx(optX)} y2={H - pad.b} stroke="#143700" strokeWidth="1" strokeDasharray="2 2" />
      <text x={sx(optX)} y={sy(optY) - 9} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono" fill="#143700" fontWeight="600">opt 23%</text>

      {/* user hover */}
      <circle cx={sx(userX)} cy={sy(userY)} r="3.5" fill="#fff" stroke="#005776" strokeWidth="1.5" />

      {/* x axis labels */}
      {[18, 20, 22, 24, 26, 28].map(t => (
        <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono" fill="#5d6f53">{t}%</text>
      ))}
      <text x={pad.l + innerW/2} y={H - 0} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono" fill="#5d6f53" letterSpacing=".06em">SIDE α-AMYLASE CEILING (% OF SPEC)</text>
    </svg>
  );
};

/* Tiny constraint-slack chart: horizontal bar chart of remaining slack per constraint */
const SlackChart = ({ constraints }) => {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {constraints.map(c => {
        const span = c.max - c.min;
        const v = c.optimised != null ? c.optimised : c.current;
        // distance of value from nearest bound, normalised
        const dMin = (v - c.min) / span;
        const dMax = (c.max - v) / span;
        const slack = Math.min(dMin, dMax);
        const pct = Math.max(2, Math.min(100, slack * 100 * 2));
        const tight = slack < 0.08;
        return (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 60px", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: tight ? "#8B2900" : "var(--forest)", fontWeight: tight ? 600 : 400 }}>{c.name}</div>
            <div style={{ height: 8, background: "var(--stone-100)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
                background: tight ? "var(--sunset)" : "var(--jade)",
                transition: "width 320ms cubic-bezier(.16,1,.3,1)" }} />
            </div>
            <div className="num" style={{ fontSize: 11, textAlign: "right", color: tight ? "#8B2900" : "var(--fg-muted)" }}>
              {tight ? "binding" : `${(slack * 100).toFixed(0)}% slack`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { SensitivityChart, SlackChart });
