/* eslint-disable jsdoc/require-jsdoc */
import React, { CSSProperties, ReactNode, useState } from "react";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { traceCopy } from "./i18n/pageCopy";

import { 
  DataTable, 
  Card, 
  KPI as SharedKPI, 
  StatusPill as SharedStatusPill, 
  Button 
} from "@connectio/shared-ui";
export type { Column } from "@connectio/shared-ui";
export { DataTable, Card, Button };

/** 
 * Legacy-compatible StatusPill for Trace2.
 * Maps 'size' to 'compact' and preserves status mapping.
 */
export const StatusPill = (props: any) => {
  const { size, ...rest } = props;
  return <SharedStatusPill compact={size === 'sm'} {...rest} />;
};

/**
 * Legacy-compatible KPI for Trace2.
 * Maps 'good'/'bad'/'muted' tones to the unified semantic set.
 */
export const KPI = (props: any) => {
  let { tone, ...rest } = props;
  if (tone === 'good') tone = 'ok';
  if (tone === 'bad') tone = 'risk';
  if (tone === 'muted') tone = 'neutral';
  return <SharedKPI tone={tone} {...rest} />;
};

// ---------------------------------------------------------------------------
// BarChart
// ---------------------------------------------------------------------------

export function BarChart<T extends Record<string, any>>({
  data, valueKey, labelKey, subKey, height, color = "var(--valentia-slate)", max, showValue = true,
  format = (v: number) => String(v), sort = true,
}: {
  data: T[];
  valueKey: keyof T;
  labelKey: keyof T;
  subKey?: keyof T;
  height?: number;
  color?: string;
  max?: number;
  showValue?: boolean;
  format?: (v: number) => string;
  sort?: boolean;
}) {
  const rows = sort ? [...data].sort((a, b) => (b[valueKey] as number) - (a[valueKey] as number)) : data;
  const m = max || Math.max(...rows.map((r) => r[valueKey] as number)) * 1.05;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height, overflow: height ? "hidden" : "visible" }}>
      {rows.map((r, i) => {
        const pct = ((r[valueKey] as number) / m) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-sans)", fontSize: 11.5 }}>
            <div style={{ width: 150, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r[labelKey] as ReactNode}
              {subKey && <span style={{ color: "var(--ink-3)", marginLeft: 6, fontSize: 10.5 }}>{r[subKey] as ReactNode}</span>}
            </div>
            <div style={{ flex: 1, height: 14, background: "var(--panel)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.5s ease" }} />
            </div>
            {showValue && <div style={{ width: 96, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{format(r[valueKey] as number)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------

export function Donut<T extends Record<string, any>>({
  data, valueKey, size = 180, colors, centerLabel, centerValue,
}: {
  data: T[];
  valueKey: keyof T;
  labelKey?: keyof T;
  size?: number;
  colors?: string[];
  centerLabel?: ReactNode;
  centerValue?: ReactNode;
}) {
  const total = data.reduce((s, d) => s + (d[valueKey] as number), 0);
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const stroke = 20;
  let acc = 0;
  const palette = colors || [
    "#005776", "#289BA2", "#44CF93", "#F9C20A", "#F24A00",
    "#FFC2B3", "#143700", "#6A9C4D", "#003C52", "#A4CFD8",
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {data.map((d, i) => {
        const frac = (d[valueKey] as number) / total;
        const dash = 2 * Math.PI * r;
        const seg = frac * dash;
        const off = -acc * dash;
        acc += frac;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={palette[i % palette.length]}
            strokeWidth={stroke}
            strokeDasharray={`${seg} ${dash - seg}`}
            strokeDashoffset={off}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
      {centerValue && (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle"
            style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, fill: "var(--forest)", fontVariantNumeric: "tabular-nums" }}
          >{centerValue}</text>
          {centerLabel && <text x={cx} y={cy + 14} textAnchor="middle"
            style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >{centerLabel}</text>}
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SimBanner
// ---------------------------------------------------------------------------

export function SimBanner({ batchId, onClear }: { batchId: string; onClear: () => void }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 18px",
      background: "#FDE5D9",
      border: "1px solid #F9C3AA",
      borderLeft: "4px solid var(--sunset)",
      borderRadius: 6,
      marginBottom: 20,
      fontSize: 13, color: "var(--ink)",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        background: "var(--sunset)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14,
        flexShrink: 0,
      }}>!</div>
      <div style={{ flex: 1 }}>
        <strong>{copy.sim.active}</strong> {copy.sim.scope.split("{{batch}}")[0]}
        <span style={{ fontFamily: "var(--font-mono)", background: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 11.5 }}>{batchId}</span>
        {copy.sim.scope.split("{{batch}}")[1]}
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--sunset)", textTransform: "uppercase" }}>{copy.sim.label}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>{copy.sim.exit}</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HexMark — Kerry hexagon decorative element
// ---------------------------------------------------------------------------

export function HexMark({ size = 22 }: { size?: number }) {
  const h = size * (Math.sqrt(3) / 2);
  return (
    <svg width={size} height={h * 1.15} viewBox="0 0 100 115" style={{ display: "block" }}>
      <polygon points="50,0 100,25 100,75 50,100 0,75 0,25" fill="var(--innovation)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function flag(code?: string): string {
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}

export function fmtN(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// ParamField — topbar key-value display
// ---------------------------------------------------------------------------

export function ParamField({ label, value, mono = true, emphasize = false }: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.14em",
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: emphasize ? 12.5 : 12,
        fontWeight: emphasize ? 500 : 400,
        color: "var(--ink)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        lineHeight: 1.3,
      }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

export function SectionHeader({ eyebrow, title, subtitle, action }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      marginBottom: 22, gap: 24,
      paddingBottom: 18,
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={{ flex: 1, minWidth: 0, maxWidth: 820 }}>
        {eyebrow && <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5, color: "var(--brand)",
          textTransform: "uppercase", letterSpacing: "0.16em",
          fontWeight: 500, marginBottom: 8,
        }}>{eyebrow}</div>}
        <h1 style={{
          fontFamily: "var(--font-sans)",
          fontSize: 28, fontWeight: 500,
          letterSpacing: "-0.015em", lineHeight: 1.18,
          color: "var(--forest)", margin: "0 0 6px",
        }}>{title}</h1>
        {subtitle && <div style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 14.5, color: "var(--ink-2)",
          lineHeight: 1.5, maxWidth: 820,
        }}>{subtitle}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DepthControl — used in lineage pages toolbar
// ---------------------------------------------------------------------------

export function DepthControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const btn: CSSProperties = {
    width: 24, height: 24,
    border: "1px solid var(--line-2)",
    background: "var(--card)", color: "var(--ink-2)",
    cursor: "pointer", fontSize: 14, lineHeight: "1",
    borderRadius: 3, fontFamily: "var(--font-sans)",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9.5,
        color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <button onClick={() => onChange(Math.max(1, value - 1))} style={btn}>−</button>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 13,
          color: "var(--ink)", minWidth: 20, textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}>{value}</span>
        <button onClick={() => onChange(Math.min(8, value + 1))} style={btn}>+</button>
      </div>
    </div>
  );
}
