import React, { useEffect, useRef, useState } from "react";
import { LINEAGE } from "../data/mock";
import { fmtN } from "../ui";
import type { FocalNode, LineageNode } from "../types";

type PlacedNode = (FocalNode | LineageNode) & { col: number; x: number; y: number };

type HighlightMode = "none" | "upstream" | "downstream";

export function LineageGraph({
  onNodeClick,
  selectedId,
  highlightMode = "none",
}: {
  onNodeClick?: (n: PlacedNode) => void;
  selectedId?: string;
  highlightMode?: HighlightMode;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<{
    startX: number; startY: number; origX: number; origY: number;
  } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const COL_W = 260;
  const NODE_W = 220;
  const NODE_H = 76;
  const LEVEL_GAP = 18;

  const up1 = LINEAGE.upstream.filter((n) => n.level === 1);
  const up2 = LINEAGE.upstream.filter((n) => n.level === 2);
  const dn1 = LINEAGE.downstream.filter((n) => n.level === 1);
  const dn2 = LINEAGE.downstream.filter((n) => n.level === 2);

  function layoutCol<T extends LineageNode>(nodes: T[], col: number): (T & { col: number; x: number; y: number })[] {
    const total = nodes.length;
    const totalH = total * NODE_H + (total - 1) * LEVEL_GAP;
    const startY = -totalH / 2;
    return nodes.map((n, i) => ({ ...n, col, x: col * COL_W, y: startY + i * (NODE_H + LEVEL_GAP) }));
  }

  function layoutNearParents<T extends LineageNode, P extends { id: string; x: number; y: number }>(
    parents: P[], children: T[], col: number,
  ): (T & { col: number; x: number; y: number })[] {
    const byParent: Record<string, T[]> = {};
    children.forEach((c) => { (byParent[c.parent] = byParent[c.parent] || []).push(c); });
    const laid: (T & { col: number; x: number; y: number })[] = [];
    parents.forEach((p) => {
      const kids = byParent[p.id] || [];
      if (!kids.length) return;
      const totalH = kids.length * NODE_H + (kids.length - 1) * LEVEL_GAP;
      const startY = p.y + NODE_H / 2 - totalH / 2;
      kids.forEach((k, i) => { laid.push({ ...k, col, x: col * COL_W, y: startY + i * (NODE_H + LEVEL_GAP) }); });
    });
    return laid;
  }

  const focalLaid: PlacedNode = { ...LINEAGE.focal, col: 0, x: 0, y: -NODE_H / 2 };
  const up1Laid = layoutCol(up1, -1);
  const up2Laid = layoutNearParents(up1Laid, up2, -2);
  const dn1Laid = layoutCol(dn1, 1);
  const dn2Laid = layoutNearParents(dn1Laid, dn2, 2);

  const allNodes: PlacedNode[] = [focalLaid, ...up1Laid, ...up2Laid, ...dn1Laid, ...dn2Laid];
  const nodeById: Record<string, PlacedNode> = Object.fromEntries(allNodes.map((n) => [n.id, n]));

  const edges: { from: PlacedNode; to: PlacedNode; direction: "upstream" | "downstream"; linkType: string }[] = [];
  [...up1Laid, ...up2Laid].forEach((n) => {
    const parent = nodeById[(n as LineageNode).parent];
    if (parent) edges.push({ from: n, to: parent, direction: "upstream", linkType: n.link });
  });
  [...dn1Laid, ...dn2Laid].forEach((n) => {
    const parent = nodeById[(n as LineageNode).parent];
    if (parent) edges.push({ from: parent, to: n, direction: "downstream", linkType: n.link });
  });

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newK = Math.max(0.4, Math.min(2.4, view.k * factor));
    const nx = mx - (mx - view.x) * (newK / view.k);
    const ny = my - (my - view.y) * (newK / view.k);
    setView({ x: nx, y: ny, k: newK });
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-node]")) return;
    setDragging({ startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y });
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

  const viewW = 1480, viewH = 560;

  function isHighlighted(nodeId: string): boolean {
    if (highlightMode === "none") return true;
    const n = allNodes.find((x) => x.id === nodeId);
    if (!n) return false;
    if (highlightMode === "upstream") return nodeId === "F" || n.col < 0;
    if (highlightMode === "downstream") return nodeId === "F" || n.col > 0;
    return true;
  }

  function nodeColor(n: PlacedNode): { fg: string; bg: string; border: string } {
    if ("kind" in n && n.kind === "focal") return { fg: "#fbf8f1", bg: "oklch(38% 0.06 155)", border: "oklch(30% 0.06 155)" };
    if (n.col < 0) return { fg: "var(--ink)", bg: "oklch(96% 0.015 80)", border: "oklch(82% 0.03 80)" };
    return { fg: "var(--ink)", bg: "oklch(97% 0.015 40)", border: "oklch(82% 0.04 40)" };
  }

  function truncate(s: string, n: number): string {
    if (!s) return "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  const NodeEl = ({ n }: { n: PlacedNode }) => {
    const isFocal = "kind" in n && n.kind === "focal";
    const col = nodeColor(n);
    const selected = n.id === selectedId;
    const hl = isHighlighted(n.id);
    const opacity = hl ? 1 : 0.25;
    const isHover = hover === n.id;
    const batchOrId = "batch" in n ? n.batch : n.batch_id;
    const label = isFocal ? "THIS BATCH" : (n.col < 0 ? `INPUT · L${Math.abs(n.col)}` : `OUTPUT · L${n.col}`);
    const sub = ("supplier" in n && n.supplier) || ("customer" in n && n.customer) || n.plant || "";
    return (
      <g data-node transform={`translate(${n.x - NODE_W / 2}, ${n.y})`}
        style={{ cursor: "pointer", opacity, transition: "opacity 200ms" }}
        onClick={(e) => { e.stopPropagation(); onNodeClick && onNodeClick(n); }}
        onMouseEnter={() => setHover(n.id)}
        onMouseLeave={() => setHover(null)}
      >
        <rect width={NODE_W} height={NODE_H}
          fill={col.bg}
          stroke={selected ? "oklch(42% 0.14 35)" : (isHover ? "var(--ink)" : col.border)}
          strokeWidth={selected ? 2 : 1}
          rx={2}
        />
        {isFocal && <rect x={0} y={0} width={4} height={NODE_H} fill="oklch(55% 0.13 40)" />}
        <text x={12} y={16} style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9.5, letterSpacing: "0.12em",
          fill: isFocal ? "rgba(251,248,241,0.72)" : "var(--ink-3)",
          textTransform: "uppercase",
        }}>{label}</text>
        <text x={12} y={36} style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 13.5, fill: col.fg, fontWeight: 500, letterSpacing: "-0.005em",
        }}>{truncate(n.material, 28)}</text>
        <text x={12} y={56} style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          fill: isFocal ? "rgba(251,248,241,0.78)" : "var(--ink-2)",
        }}>{batchOrId} · {n.material_id}</text>
        <text x={NODE_W - 12} y={56} textAnchor="end" style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
          fill: isFocal ? "rgba(251,248,241,0.78)" : "var(--ink-2)",
          fontVariantNumeric: "tabular-nums",
        }}>{fmtN(n.qty, 1)} {n.uom}</text>
        <text x={12} y={70} style={{
          fontFamily: "'Inter', sans-serif", fontSize: 9.5,
          fill: isFocal ? "rgba(251,248,241,0.55)" : "var(--ink-3)",
        }}>{truncate(sub as string, 36)}</text>
      </g>
    );
  };

  const EdgeEl = ({ e }: { e: { from: PlacedNode; to: PlacedNode; linkType: string } }) => {
    const { from, to, linkType } = e;
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x - NODE_W / 2;
    const y2 = to.y + NODE_H / 2;
    const dx = Math.abs(x2 - x1);
    const cp = dx * 0.5;
    const path = `M${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
    const hl = isHighlighted(from.id) && isHighlighted(to.id);
    const dashed = linkType === "CONSUMPTION" || linkType === "INTERNAL";
    return (
      <path d={path}
        stroke="var(--ink-3)" strokeWidth={1} fill="none"
        opacity={hl ? 0.55 : 0.15}
        strokeDasharray={dashed ? "3 3" : undefined}
      />
    );
  };

  return (
    <div style={{ position: "relative", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 4, height: viewH, overflow: "hidden" }}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`${-viewW / 2} ${-viewH / 2} ${viewW} ${viewH}`}
        onWheel={onWheel} onMouseDown={onMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab", userSelect: "none", display: "block" }}
      >
        <defs>
          <pattern id="grid" x={0} y={0} width={40} height={40} patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line)" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect x={-viewW} y={-viewH} width={viewW * 2} height={viewH * 2} fill="url(#grid)" />
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          {[-2, -1, 1, 2].map((c) => (
            <rect key={c} x={c * COL_W - NODE_W / 2 - 20} y={-240}
              width={NODE_W + 40} height={480}
              fill={c < 0 ? "oklch(96% 0.012 85 / 0.35)" : "oklch(97% 0.012 45 / 0.35)"}
            />
          ))}
          {[{ c: -2, l: "TIER 2 · RAW" }, { c: -1, l: "TIER 1 · INPUTS" }, { c: 1, l: "TIER 1 · OUTPUTS" }, { c: 2, l: "TIER 2 · FINISHED" }].map(({ c, l }) => (
            <text key={c} x={c * COL_W} y={-220} textAnchor="middle"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.14em", fill: "var(--ink-3)" }}
            >{l}</text>
          ))}
          <text x={0} y={-220} textAnchor="middle"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.14em", fill: "oklch(38% 0.06 155)" }}
          >FOCAL BATCH</text>
          {edges.map((e, i) => <EdgeEl key={i} e={e} />)}
          {allNodes.map((n) => <NodeEl key={n.id} n={n} />)}
        </g>
      </svg>
      <div style={{
        position: "absolute", bottom: 14, right: 14,
        display: "flex", gap: 6,
        background: "var(--card)", border: "1px solid var(--line-2)", borderRadius: 2,
        padding: 4, fontFamily: "'Inter', sans-serif", fontSize: 11,
      }}>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(2.4, v.k * 1.2) }))} style={toolBtn}>＋</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.4, v.k / 1.2) }))} style={toolBtn}>−</button>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })} style={toolBtn}>Reset</button>
      </div>
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        background: "var(--card)", border: "1px solid var(--line-2)",
        padding: "6px 10px", borderRadius: 2,
        fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: "var(--ink-3)",
      }}>
        Drag to pan · scroll to zoom · click a node
      </div>
    </div>
  );
}

const toolBtn: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 2,
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
  color: "var(--ink)",
};
