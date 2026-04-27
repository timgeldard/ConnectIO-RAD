import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { traceCopy } from "../i18n/pageCopy";
import { fmtN } from "../ui";
import type { FocalNode, LineageNode } from "../types";

type PlacedLineage = LineageNode & { col: number; x: number; y: number };
type PlacedFocal = FocalNode & { col: 0; x: number; y: number };
type PlacedNode = PlacedLineage | PlacedFocal;

type HighlightMode = "none" | "upstream" | "downstream";

const COL_W = 260;
const NODE_W = 220;
const NODE_H = 76;
const LEVEL_GAP = 18;
const PADDING_Y = 40;

const LINK_STYLE: Record<string, { stroke: string; dash?: string; label: string }> = {
  RECEIPT:     { stroke: "#289BA2", label: "RECEIPT" },
  CONSUMPTION: { stroke: "#F9C20A", dash: "4 3", label: "CONSUMPTION" },
  INTERNAL:    { stroke: "#8A9E6A", dash: "4 3", label: "INTERNAL" },
  SALES_ORDER: { stroke: "#005776", label: "SALES_ORDER" },
};

function edgeStyle(linkType: string) {
  return LINK_STYLE[linkType] ?? { stroke: "var(--ink-3)", label: linkType };
}

interface Props {
  focal: FocalNode;
  upstream: LineageNode[];
  downstream: LineageNode[];
  highlightMode?: HighlightMode;
  selectedId?: string;
  onNodeClick?: (n: PlacedNode) => void;
  sim?: boolean;
}

export function LineageGraph({
  focal,
  upstream,
  downstream,
  highlightMode = "none",
  selectedId,
  onNodeClick,
  sim = false,
}: Props) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<{
    startX: number; startY: number; origX: number; origY: number;
  } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const rawMaxUp = useMemo(() => upstream.reduce((m, n) => Math.max(m, n.level), 0), [upstream]);
  const rawMaxDn = useMemo(() => downstream.reduce((m, n) => Math.max(m, n.level), 0), [downstream]);
  const [depthUp, setDepthUp] = useState<number>(99);
  const [depthDn, setDepthDn] = useState<number>(99);
  // Reset depth filters when focal changes
  useEffect(() => { setDepthUp(99); setDepthDn(99); }, [focal.id]);

  const { allNodes, edges, maxUp, maxDn, selfTransfers } = useMemo(() => {
    const upFiltered = upstream.filter((n) => n.id !== focal.id && n.level <= depthUp);
    const dnFiltered = downstream.filter((n) => n.id !== focal.id && n.level <= depthDn);
    const selfTransfers: { direction: "up" | "down"; plant: string; qty: number; uom: string; link: string }[] = [];
    for (const n of upstream) {
      if (n.id === focal.id) {
        selfTransfers.push({ direction: "up", plant: n.plant, qty: n.qty, uom: n.uom, link: n.link });
      }
    }
    for (const n of downstream) {
      if (n.id === focal.id) {
        selfTransfers.push({ direction: "down", plant: n.plant, qty: n.qty, uom: n.uom, link: n.link });
      }
    }
    const laid = layoutGraph(focal, upFiltered, dnFiltered);
    return { ...laid, selfTransfers };
  }, [focal, upstream, downstream, depthUp, depthDn]);

  const nodeById: Record<string, PlacedNode> = useMemo(
    () => Object.fromEntries(allNodes.map((n) => [n.id, n])),
    [allNodes],
  );

  // Auto-fit viewport to content bbox + margin, with lower bounds so tiny
  // graphs (one or two nodes) don't blow up in size.
  const margin = 120;
  const contentMinX =
    allNodes.length > 0 ? Math.min(...allNodes.map((n) => n.x - NODE_W / 2)) : -NODE_W / 2;
  const contentMaxX =
    allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.x + NODE_W / 2)) : NODE_W / 2;
  const contentMinY =
    allNodes.length > 0 ? Math.min(...allNodes.map((n) => n.y)) : 0;
  const contentMaxY =
    allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.y + NODE_H)) : NODE_H;
  const contentW = Math.max(contentMaxX - contentMinX, NODE_W);
  const contentH = Math.max(contentMaxY - contentMinY, NODE_H);
  // Minimum viewBox width so a single node doesn't render at card-width scale.
  const MIN_VIEW_W = 1200;
  const MIN_VIEW_H = 500;
  const viewW = Math.max(MIN_VIEW_W, contentW + margin * 2);
  const viewH = Math.max(MIN_VIEW_H, contentH + margin * 2);
  const viewCX = (contentMinX + contentMaxX) / 2;
  const viewCY = (contentMinY + contentMaxY) / 2;
  const spanY = viewH / 2;

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newK = Math.max(0.3, Math.min(2.4, view.k * factor));
    const nx = mx - (mx - view.x) * (newK / view.k);
    const ny = my - (my - view.y) * (newK / view.k);
    setView({ x: nx, y: ny, k: newK });
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-node]")) return;
    setDragging({ startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y });
  };

  const fitView = () => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fitMarginPx = 40;
    const kx = (rect.width - 2 * fitMarginPx) * viewW / (contentW * rect.width);
    const ky = (rect.height - 2 * fitMarginPx) * viewH / (contentH * rect.height);
    const k = Math.max(0.3, Math.min(2.4, Math.min(kx, ky)));
    setView({ x: -viewCX * k, y: -viewCY * k, k });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setView((v) => ({ ...v, x: dragging.origX + (e.clientX - dragging.startX), y: dragging.origY + (e.clientY - dragging.startY) }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  useEffect(() => {
    setView({ x: 0, y: 0, k: 1 });
  }, [focal.id, upstream.length, downstream.length]);

  if (allNodes.length <= 1) {
    return (
      <div style={{
        background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 4,
        padding: "48px 16px", textAlign: "center",
        fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-3)",
      }}>
        {copy.line.noEdges}
      </div>
    );
  }

  function isHighlighted(nodeId: string): boolean {
    if (highlightMode === "none") return true;
    const n = nodeById[nodeId];
    if (!n) return false;
    if (highlightMode === "upstream") return n.col <= 0;
    if (highlightMode === "downstream") return n.col >= 0;
    return true;
  }

  const NodeEl = ({ n }: { n: PlacedNode }) => {
    const isFocal = "kind" in n && n.kind === "focal";
    const col = nodeColor(n, sim);
    const selected = n.id === selectedId;
    const hl = isHighlighted(n.id);
    const opacity = hl ? 1 : 0.25;
    const isHover = hover === n.id;
    const lineageN = n as PlacedLineage;
    const batchLabel = isFocal ? (n as PlacedFocal).batch_id : lineageN.batch;
    const level = isFocal ? 0 : lineageN.level;
    const label = isFocal
      ? copy.common.thisBatch.toUpperCase()
      : n.col < 0
      ? `${copy.common.input.toUpperCase()} · L${level}`
      : `${copy.common.output.toUpperCase()} · L${level}`;
    const accentColor = isFocal
      ? "#DFFF11"
      : (LINK_STYLE[lineageN.link]?.stroke ?? "var(--ink-3)");
    const partyName = !isFocal
      ? (lineageN.supplier || lineageN.customer || "")
      : "";
    return (
      <g data-node transform={`translate(${n.x - NODE_W / 2}, ${n.y})`}
        style={{ cursor: "pointer", opacity, transition: "opacity 200ms" }}
        onClick={(e) => { e.stopPropagation(); onNodeClick && onNodeClick(n); }}
        onMouseEnter={() => setHover(n.id)}
        onMouseLeave={() => setHover(null)}
      >
        <rect width={NODE_W} height={NODE_H}
          fill={col.bg}
          stroke={selected ? "#F24A00" : (isHover ? "var(--ink)" : col.border)}
          strokeWidth={selected ? 2 : 1}
          rx={2}
        />
        {/* link-type / focal accent bar */}
        <rect x={0} y={0} width={4} height={NODE_H} fill={accentColor} rx={2} />
        <rect x={0} y={2} width={4} height={NODE_H - 4} fill={accentColor} />
        <text x={14} y={16} style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5, letterSpacing: "0.12em",
          fill: isFocal ? "rgba(251,248,241,0.72)" : "var(--ink-3)",
          textTransform: "uppercase",
        }}>{label}</text>
        {/* link type badge for non-focal nodes */}
        {!isFocal && (
          <>
            <rect x={NODE_W - 60} y={5} width={54} height={14} rx={2}
              fill={accentColor} opacity={0.15} />
            <text x={NODE_W - 33} y={15} textAnchor="middle" style={{
              fontFamily: "var(--font-mono)", fontSize: 8,
              letterSpacing: "0.1em", fill: accentColor,
            }}>{lineageN.link}</text>
          </>
        )}
        <text x={14} y={36} style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13.5, fill: col.fg, fontWeight: 500, letterSpacing: "-0.005em",
        }}>{truncate(n.material, 26)}</text>
        <text x={14} y={54} style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          fill: isFocal ? "rgba(251,248,241,0.78)" : "var(--ink-2)",
        }}>{batchLabel} · {n.material_id}</text>
        <text x={NODE_W - 12} y={54} textAnchor="end" style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          fill: isFocal ? "rgba(251,248,241,0.78)" : "var(--ink-2)",
          fontVariantNumeric: "tabular-nums",
        }}>{fmtN(n.qty, 1)} {n.uom}</text>
        {/* plant badge */}
        {n.plant && (
          <>
            <rect x={14} y={60} width={Math.min(n.plant.length * 5.8 + 8, 120)} height={13} rx={2}
              fill={isFocal ? "#002A3A" : "var(--line)"} />
            <text x={18} y={70} style={{
              fontFamily: "var(--font-mono)", fontSize: 8.5,
              fill: isFocal ? "rgba(251,248,241,0.7)" : "var(--ink-3)",
              letterSpacing: "0.06em",
            }}>{truncate(n.plant, 18)}</text>
          </>
        )}
        {partyName && (
          <text x={NODE_W - 12} y={70} textAnchor="end" style={{
            fontFamily: "var(--font-sans)", fontSize: 9,
            fill: isFocal ? "rgba(251,248,241,0.55)" : "var(--ink-3)",
          }}>{truncate(partyName, 22)}</text>
        )}
      </g>
    );
  };

  const EdgeEl = ({ e }: { e: { from: PlacedNode; to: PlacedNode; linkType: string } }) => {
    const { from, to, linkType } = e;
    const ls = edgeStyle(linkType);
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x - NODE_W / 2;
    const y2 = to.y + NODE_H / 2;
    const dx = Math.abs(x2 - x1);
    const cp = dx * 0.5;
    const path = `M${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
    const hl = isHighlighted(from.id) && isHighlighted(to.id);
    return (
      <path d={path}
        stroke={ls.stroke} strokeWidth={1.5} fill="none"
        opacity={hl ? 0.7 : 0.15}
        strokeDasharray={ls.dash}
        markerEnd={`url(#arrow-${linkType})`}
      />
    );
  };

  const columnLabels: { c: number; l: string }[] = [];
  for (let c = maxUp; c >= 1; c--) {
    columnLabels.push({ c: -c, l: columnLabel("up", c, maxUp, copy) });
  }
  for (let c = 1; c <= maxDn; c++) {
    columnLabels.push({ c, l: columnLabel("down", c, maxDn, copy) });
  }

  const clampDepth = (v: number, max: number) => Math.max(1, Math.min(max, v));

  // Minimap geometry
  const MM_W = 156, MM_H = 90, mmPad = 5;
  const mmInW = MM_W - 2 * mmPad, mmInH = MM_H - 2 * mmPad;
  const mmScale = Math.min(mmInW / Math.max(contentW, 1), mmInH / Math.max(contentH, 1));
  const mmOffX = mmPad + (mmInW - contentW * mmScale) / 2;
  const mmOffY = mmPad + (mmInH - contentH * mmScale) / 2;
  const toMM = (cx: number, cy: number) => ({
    x: (cx - contentMinX) * mmScale + mmOffX,
    y: (cy - contentMinY) * mmScale + mmOffY,
  });
  const vpMinX = (-viewW / 2 - view.x) / view.k;
  const vpMinY = (-viewH / 2 - view.y) / view.k;
  const vpMaxX = (viewW / 2 - view.x) / view.k;
  const vpMaxY = (viewH / 2 - view.y) / view.k;
  const vpMM = {
    x: (vpMinX - contentMinX) * mmScale + mmOffX,
    y: (vpMinY - contentMinY) * mmScale + mmOffY,
    w: (vpMaxX - vpMinX) * mmScale,
    h: (vpMaxY - vpMinY) * mmScale,
  };

  return (
    <div>
    {(rawMaxUp > 1 || rawMaxDn > 1) && (
      <div style={{
        display: "flex", alignItems: "center", gap: 20, padding: "6px 12px",
        background: "var(--card)", borderBottom: "1px solid var(--line)",
        fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-2)",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.12em", color: "var(--ink-3)" }}>{copy.common.depth.toUpperCase()}</span>
        {rawMaxUp > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>{copy.common.up}</span>
            <button style={depthBtn} onClick={() => setDepthUp((d) => clampDepth(d - 1, rawMaxUp))}>−</button>
            <span style={{ fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "center" }}>
              {Math.min(depthUp, rawMaxUp)} / {rawMaxUp}
            </span>
            <button style={depthBtn} onClick={() => setDepthUp((d) => clampDepth(d + 1, rawMaxUp))}>＋</button>
            <button style={{ ...depthBtn, fontSize: 10 }} onClick={() => setDepthUp(99)}>{copy.common.all}</button>
          </div>
        )}
        {rawMaxDn > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>{copy.common.down}</span>
            <button style={depthBtn} onClick={() => setDepthDn((d) => clampDepth(d - 1, rawMaxDn))}>−</button>
            <span style={{ fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "center" }}>
              {Math.min(depthDn, rawMaxDn)} / {rawMaxDn}
            </span>
            <button style={depthBtn} onClick={() => setDepthDn((d) => clampDepth(d + 1, rawMaxDn))}>＋</button>
            <button style={{ ...depthBtn, fontSize: 10 }} onClick={() => setDepthDn(99)}>{copy.common.all}</button>
          </div>
        )}
      </div>
    )}
    <div style={{ position: "relative", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 4, height: 560, overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 10, right: 14, zIndex: 2,
        background: "var(--card)", border: "1px solid var(--line-2)",
        padding: "6px 10px", borderRadius: 2,
        fontFamily: "var(--font-mono)", fontSize: 9.5,
        letterSpacing: "0.08em", color: "var(--ink-3)",
        display: "flex", flexDirection: "column", gap: 5,
        pointerEvents: "none",
      }}>
        {Object.entries(LINK_STYLE).map(([lt, { stroke, dash }]) => (
          <div key={lt} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width={30} height={10} style={{ overflow: "visible" }}>
              <line x1={0} y1={5} x2={26} y2={5}
                stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} />
              <polygon points="26,2 32,5 26,8" fill={stroke} />
            </svg>
            <span>{lt}</span>
          </div>
        ))}
      </div>
      {selfTransfers.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 14,
            right: 200,
            zIndex: 2,
            padding: "6px 10px",
            background: "rgba(250,250,242,0.92)",
            border: "1px solid var(--line-2)",
            borderRadius: 2,
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "var(--ink-2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "var(--ink-3)",
              textTransform: "uppercase",
            }}
          >
            {copy.common.thisBatch}
          </span>
          <span>
            {selfTransfers
              .map((t) => `${t.direction === "down" ? "→" : "←"} ${t.plant || "other plant"} (${fmtN(t.qty, 0)} ${t.uom})`)
              .join(" · ")}
          </span>
        </div>
      )}
      <svg ref={svgRef} width="100%" height="100%" viewBox={`${viewCX - viewW / 2} ${viewCY - viewH / 2} ${viewW} ${viewH}`}
        onWheel={onWheel} onMouseDown={onMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab", userSelect: "none", display: "block" }}
      >
        <defs>
          <pattern id="grid" x={0} y={0} width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line)" strokeWidth={0.5} />
          </pattern>
          {Object.entries(LINK_STYLE).map(([lt, { stroke }]) => (
            <marker key={lt} id={`arrow-${lt}`} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="9" markerHeight="9" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
            </marker>
          ))}
        </defs>
        <rect x={viewCX - viewW} y={viewCY - viewH} width={viewW * 2} height={viewH * 2} fill="url(#grid)" />
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          {columnLabels.map(({ c }) => (
            <rect key={c} x={c * COL_W - NODE_W / 2 - 20} y={viewCY - spanY + PADDING_Y}
              width={NODE_W + 40} height={spanY * 2 - PADDING_Y * 2}
              fill={c < 0 ? "rgba(227,238,243,0.35)" : "rgba(241,241,229,0.35)"}
            />
          ))}
          {columnLabels.map(({ c, l }) => (
            <text key={c} x={c * COL_W} y={viewCY - spanY + PADDING_Y - 10} textAnchor="middle"
              style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", fill: "var(--ink-3)" }}
            >{l}</text>
          ))}
          <text x={0} y={viewCY - spanY + PADDING_Y - 10} textAnchor="middle"
            style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", fill: "#005776" }}
          >{copy.common.focalBatch.toUpperCase()}</text>
          {edges.map((e, i) => <EdgeEl key={i} e={e} />)}
          {allNodes.map((n) => <NodeEl key={n.id} n={n} />)}
        </g>
      </svg>
      <div style={{
        position: "absolute", bottom: 14, right: 14,
        display: "flex", gap: 6,
        background: "var(--card)", border: "1px solid var(--line-2)", borderRadius: 2,
        padding: 4, fontFamily: "var(--font-sans)", fontSize: 11,
      }}>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(2.4, v.k * 1.2) }))} style={toolBtn}>＋</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))} style={toolBtn}>−</button>
        <button onClick={fitView} style={toolBtn}>{copy.common.fit}</button>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })} style={toolBtn}>{copy.common.reset}</button>
      </div>
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "var(--card)", border: "1px solid var(--line-2)", borderRadius: 2,
        overflow: "hidden",
      }} title={copy.line.tooltip}>
        <svg width={MM_W} height={MM_H} style={{ display: "block" }}>
          <rect width={MM_W} height={MM_H} fill="var(--paper)" />
          {allNodes.map((n) => {
            const isFocal = "kind" in n && n.kind === "focal";
            const pos = toMM(n.x - NODE_W / 2, n.y);
            const w = NODE_W * mmScale;
            const h = NODE_H * mmScale;
            const fill = isFocal
              ? "#003C52"
              : n.col < 0 ? "#A4CFD8" : "#C8D8C0";
            return <rect key={n.id} x={pos.x} y={pos.y} width={Math.max(w, 2)} height={Math.max(h, 2)} fill={fill} rx={1} />;
          })}
          {/* viewport rect */}
          <rect
            x={vpMM.x} y={vpMM.y} width={Math.max(vpMM.w, 2)} height={Math.max(vpMM.h, 2)}
            fill="rgba(0,87,118,0.12)"
            stroke="#005776"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
    </div>
  );
}

export function NodeDetailPanel({
  node,
  onClose,
}: {
  node: LineageNode | null;
  onClose: () => void;
}) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  if (!node) return null;
  const ls = LINK_STYLE[node.link];
  const accentColor = ls?.stroke ?? "var(--ink-3)";
  const dir = node.level > 0 ? (node.link === "SALES_ORDER" ? copy.common.output : copy.common.input) : copy.common.node ?? "Node";
  const party = node.supplier || node.customer || null;
  return (
    <div style={{
      border: "1px solid var(--line)",
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 4,
      background: "var(--card)",
      padding: "14px 20px",
      marginBottom: 20,
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr",
      gap: "10px 24px",
      position: "relative",
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 10, right: 12,
          background: "transparent", border: "none",
          cursor: "pointer", fontSize: 14, color: "var(--ink-3)", lineHeight: 1,
        }}
        aria-label={copy.common.close}
      >✕</button>
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9.5,
          letterSpacing: "0.12em", color: accentColor, textTransform: "uppercase",
        }}>
          {dir} · L{node.level} · {node.link}
        </span>
      </div>
      <div style={{ gridColumn: "1 / 3" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)", marginBottom: 2 }}>{copy.line.nodeMaterial.toUpperCase()}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>{node.material}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-2)", marginTop: 2 }}>{node.material_id}</div>
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)", marginBottom: 2 }}>{copy.line.nodeBatch.toUpperCase()}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{node.batch}</div>
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)", marginBottom: 2 }}>{copy.line.nodeQty.toUpperCase()}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {fmtN(node.qty, 1)} {node.uom}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)", marginBottom: 2 }}>{copy.line.nodePlant.toUpperCase()}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink)" }}>{node.plant || "—"}</div>
      </div>
      {party && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)", marginBottom: 2 }}>
            {node.supplier ? copy.line.nodeSupplier.toUpperCase() : copy.line.nodeCustomer.toUpperCase()}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink)" }}>{party}</div>
        </div>
      )}
    </div>
  );
}

function columnLabel(dir: "up" | "down", level: number, max: number, copy: ReturnType<typeof traceCopy>): string {
  if (dir === "up") {
    if (level === 1) return `L1 · ${copy.common.inputs.toUpperCase()}`;
    if (level === 2 && max === 2) return `L2 · ${copy.common.raw.toUpperCase()}`;
    return `L${level} · ${copy.common.up.toUpperCase()}`;
  }
  if (level === 1) return `L1 · ${copy.common.outputs.toUpperCase()}`;
  if (level === 2 && max === 2) return `L2 · ${copy.common.finished.toUpperCase()}`;
  return `L${level} · ${copy.common.down.toUpperCase()}`;
}

function nodeColor(n: PlacedNode, sim = false): { fg: string; bg: string; border: string } {
  if ("kind" in n && n.kind === "focal") {
    return { fg: "#fff", bg: "#003C52", border: "#002A3A" };
  }
  if (n.col < 0) {
    return { fg: "var(--ink)", bg: "#E3EEF3", border: "#A4CFD8" };
  }
  if (sim) {
    return { fg: "var(--ink)", bg: "#FDE5D9", border: "#F24A00" };
  }
  return { fg: "var(--ink)", bg: "#F1F1E5", border: "#C8D8C0" };
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function layoutGraph(
  focal: FocalNode,
  upstream: LineageNode[],
  downstream: LineageNode[],
): {
  allNodes: PlacedNode[];
  edges: { from: PlacedNode; to: PlacedNode; linkType: string }[];
  maxUp: number;
  maxDn: number;
} {
  const focalLaid: PlacedFocal = { ...focal, col: 0, x: 0, y: -NODE_H / 2 };

  const upLevels = groupByLevel(upstream);
  const dnLevels = groupByLevel(downstream);
  const maxUp = upLevels.length;
  const maxDn = dnLevels.length;

  const placed: Record<string, PlacedLineage> = {};
  const upPlacedByLevel: PlacedLineage[][] = [];
  const dnPlacedByLevel: PlacedLineage[][] = [];

  for (let depth = 1; depth <= maxUp; depth++) {
    const nodes = upLevels[depth - 1] ?? [];
    const col = -depth;
    const raw =
      depth === 1
        ? layoutCol(nodes, col)
        : layoutNearParents(upPlacedByLevel[depth - 2], nodes, col);
    const laid = deoverlapCol(raw);
    upPlacedByLevel.push(laid);
    for (const n of laid) placed[n.id] = n;
  }

  for (let depth = 1; depth <= maxDn; depth++) {
    const nodes = dnLevels[depth - 1] ?? [];
    const col = depth;
    const raw =
      depth === 1
        ? layoutCol(nodes, col)
        : layoutNearParents(dnPlacedByLevel[depth - 2], nodes, col);
    const laid = deoverlapCol(raw);
    dnPlacedByLevel.push(laid);
    for (const n of laid) placed[n.id] = n;
  }

  const allNodes: PlacedNode[] = [focalLaid, ...Object.values(placed)];
  const nodeById: Record<string, PlacedNode> = Object.fromEntries(allNodes.map((n) => [n.id, n]));

  const edges: { from: PlacedNode; to: PlacedNode; linkType: string }[] = [];
  const missingParents: string[] = [];
  const addEdge = (child: PlacedLineage, direction: "up" | "down") => {
    const parent = nodeById[child.parent];
    if (!parent) {
      missingParents.push(child.parent);
      return;
    }
    if (direction === "up") {
      edges.push({ from: child, to: parent, linkType: child.link });
    } else {
      edges.push({ from: parent, to: child, linkType: child.link });
    }
  };
  for (const tier of upPlacedByLevel) for (const n of tier) addEdge(n, "up");
  for (const tier of dnPlacedByLevel) for (const n of tier) addEdge(n, "down");

  if (missingParents.length > 0 && typeof console !== "undefined") {
    const unique = Array.from(new Set(missingParents)).slice(0, 5);
    // eslint-disable-next-line no-console
    console.warn("LineageGraph: edges dropped due to missing parent nodes", {
      count: missingParents.length,
      sample: unique,
    });
  }

  return { allNodes, edges, maxUp, maxDn };
}

function groupByLevel(nodes: LineageNode[]): LineageNode[][] {
  const max = nodes.reduce((m, n) => Math.max(m, n.level), 0);
  const buckets: LineageNode[][] = Array.from({ length: max }, () => []);
  for (const n of nodes) {
    const idx = Math.max(1, Math.floor(n.level)) - 1;
    if (idx >= 0 && idx < max) buckets[idx].push(n);
  }
  return buckets;
}

function deoverlapCol(nodes: PlacedLineage[]): PlacedLineage[] {
  if (nodes.length <= 1) return nodes;
  const sorted = [...nodes].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const minY = sorted[i - 1].y + NODE_H + LEVEL_GAP;
    if (sorted[i].y < minY) sorted[i] = { ...sorted[i], y: minY };
  }
  return sorted;
}

function layoutCol(nodes: LineageNode[], col: number): PlacedLineage[] {
  if (nodes.length === 0) return [];
  const totalH = nodes.length * NODE_H + (nodes.length - 1) * LEVEL_GAP;
  const startY = -totalH / 2;
  return nodes.map((n, i) => ({
    ...n,
    col,
    x: col * COL_W,
    y: startY + i * (NODE_H + LEVEL_GAP),
  }));
}

function layoutNearParents(
  parents: PlacedLineage[],
  children: LineageNode[],
  col: number,
): PlacedLineage[] {
  if (children.length === 0) return [];
  const byParent: Record<string, LineageNode[]> = {};
  for (const c of children) {
    (byParent[c.parent] = byParent[c.parent] || []).push(c);
  }
  const laid: PlacedLineage[] = [];
  const orphans: LineageNode[] = [];
  const taken = new Set<string>();
  for (const p of parents) {
    const kids = byParent[p.id] || [];
    if (!kids.length) continue;
    const totalH = kids.length * NODE_H + (kids.length - 1) * LEVEL_GAP;
    const startY = p.y + NODE_H / 2 - totalH / 2;
    kids.forEach((k, i) => {
      laid.push({
        ...k,
        col,
        x: col * COL_W,
        y: startY + i * (NODE_H + LEVEL_GAP),
      });
      taken.add(k.id);
    });
  }
  for (const c of children) {
    if (!taken.has(c.id) && !laid.find((l) => l.id === c.id)) {
      orphans.push(c);
    }
  }
  if (orphans.length > 0) {
    const existingSpan = laid.length
      ? Math.max(...laid.map((n) => n.y + NODE_H)) - Math.min(...laid.map((n) => n.y))
      : 0;
    const orphanSpan = orphans.length * NODE_H + (orphans.length - 1) * LEVEL_GAP;
    const startY = (laid.length ? Math.max(...laid.map((n) => n.y + NODE_H)) : -orphanSpan / 2) + LEVEL_GAP * 2;
    orphans.forEach((o, i) => {
      laid.push({
        ...o,
        col,
        x: col * COL_W,
        y: startY + i * (NODE_H + LEVEL_GAP),
      });
    });
    void existingSpan;
  }
  return laid;
}

const toolBtn: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 2,
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  color: "var(--ink)",
};

const depthBtn: React.CSSProperties = {
  padding: "2px 8px",
  background: "var(--paper)",
  border: "1px solid var(--line-2)",
  borderRadius: 2,
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  color: "var(--ink)",
};
