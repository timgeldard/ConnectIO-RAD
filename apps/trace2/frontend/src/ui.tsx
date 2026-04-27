import React, { CSSProperties, ReactNode, useState } from "react";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { traceCopy } from "./i18n/pageCopy";

// ---------------------------------------------------------------------------
// Status tokens — Kerry palette
// ---------------------------------------------------------------------------

type TokenKey = string;

export const STATUS_TOKENS: Record<TokenKey, { label: string; fg: string; bg: string; border: string; dot: string }> = {
  UNRESTRICTED:       { label: "Unrestricted",       fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  QUALITY_INSPECTION: { label: "Quality inspection", fg: "#7A5A05", bg: "#FEF5DB", border: "#F3E0A0", dot: "#F9C20A" },
  Q_INSP:             { label: "Quality inspection", fg: "#7A5A05", bg: "#FEF5DB", border: "#F3E0A0", dot: "#F9C20A" },
  RESTRICTED:         { label: "Restricted",         fg: "#7A5A05", bg: "#FEF5DB", border: "#F3E0A0", dot: "#F9C20A" },
  BLOCKED:            { label: "Blocked",             fg: "#9B3100", bg: "#FDE5D9", border: "#F9C3AA", dot: "#F24A00" },
  IN_TRANSIT:         { label: "In transit",          fg: "#004968", bg: "#DFECF1", border: "#B0D0DD", dot: "#289BA2" },
  DELIVERED:          { label: "Delivered",           fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  PLANNED:            { label: "Planned",             fg: "#31421F", bg: "#EDEDE2", border: "#D9D9CB", dot: "#8A9E6A" },
  RELEASED:           { label: "Released",            fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  IN_PROC:            { label: "In production",       fg: "#004968", bg: "#DFECF1", border: "#B0D0DD", dot: "#289BA2" },
  ACCEPTED:           { label: "Accepted",            fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  REJECTED:           { label: "Rejected",            fg: "#9B3100", bg: "#FDE5D9", border: "#F9C3AA", dot: "#F24A00" },
  LOW:                { label: "Low risk",            fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  MEDIUM:             { label: "Medium risk",         fg: "#7A5A05", bg: "#FEF5DB", border: "#F3E0A0", dot: "#F9C20A" },
  HIGH:               { label: "High risk",           fg: "#9B3100", bg: "#FDE5D9", border: "#F9C3AA", dot: "#F24A00" },
  CRITICAL:           { label: "Critical",            fg: "#FFFFFF", bg: "#F24A00", border: "#F24A00", dot: "#FFFFFF" },
  WITHIN_SHELF_LIFE:  { label: "Within shelf life",   fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  OK:                 { label: "Within shelf life",   fg: "#1B6E3F", bg: "#E4F5EB", border: "#BCE5CB", dot: "#44CF93" },
  Warning:            { label: "Near expiry",         fg: "#7A5A05", bg: "#FEF5DB", border: "#F3E0A0", dot: "#F9C20A" },
  Critical:           { label: "Expires soon",        fg: "#9B3100", bg: "#FDE5D9", border: "#F9C3AA", dot: "#F24A00" },
  Expired:            { label: "Expired",             fg: "#9B3100", bg: "#FDE5D9", border: "#F9C3AA", dot: "#F24A00" },
  UNKNOWN:            { label: "Unknown",             fg: "#31421F", bg: "#EDEDE2", border: "#D9D9CB", dot: "#8A9E6A" },
};

export function StatusPill({ status, children, size = "md" }: { status: string; children?: ReactNode; size?: "sm" | "md" }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const t = STATUS_TOKENS[status] ?? { label: status, fg: "#31421F", bg: "#EDEDE2", border: "#D9D9CB", dot: "#8A9E6A" };
  const pad = size === "sm" ? "2px 7px" : "3px 9px";
  const fs = size === "sm" ? 9.5 : 10.5;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: t.bg, color: t.fg,
      padding: pad, borderRadius: 999,
      border: `1px solid ${t.border}`,
      fontSize: fs, fontWeight: 500,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.06em", textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: t.dot, opacity: 0.85 }} />
      {children || copy.status[status as keyof typeof copy.status] || t.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI — Kerry card with left-border tone stripe
// ---------------------------------------------------------------------------

type Tone = "default" | "good" | "warn" | "bad" | "muted" | "brand";

export function KPI({ label, value, unit, sub, tone = "default", large = false }: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  large?: boolean;
}) {
  const stripes: Record<Tone, string> = {
    default: "var(--line-2)",
    good:    "var(--jade)",
    warn:    "var(--sunrise)",
    bad:     "var(--sunset)",
    brand:   "var(--valentia-slate)",
    muted:   "var(--line-2)",
  };
  const valueFg: Record<Tone, string> = {
    default: "var(--forest)",
    good:    "var(--forest)",
    warn:    "var(--forest)",
    bad:     "var(--forest)",
    brand:   "var(--brand)",
    muted:   "var(--ink-3)",
  };
  return (
    <div style={{
      padding: "12px 14px 12px 18px",
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 8,
      boxShadow: "0 1px 2px rgba(20,55,0,0.025)",
      display: "flex", flexDirection: "column", gap: 4,
      minHeight: large ? 104 : 88,
      justifyContent: "space-between",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* left tone stripe */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 3, background: stripes[tone],
      }} />
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.12em",
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, color: valueFg[tone] }}>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: large ? 32 : 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}>{value}</span>
        {unit && <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em",
        }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ title, subtitle, action, children, padding = 20, noPad, style }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  padding?: number;
  noPad?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 8,
      boxShadow: "0 1px 2px rgba(20,55,0,0.025)",
      display: "flex", flexDirection: "column",
      ...style,
    }}>
      {(title || action) && (
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "14px 18px 10px",
          borderBottom: "1px solid var(--line)",
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14, fontWeight: 600,
              letterSpacing: "-0.005em", color: "var(--forest)",
            }}>{title}</div>}
            {subtitle && <div style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11.5, color: "var(--ink-3)",
              marginTop: 2,
            }}>{subtitle}</div>}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : padding, flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export interface Column<T> {
  header: ReactNode;
  key?: keyof T;
  align?: "left" | "right" | "center";
  width?: number | string;
  mono?: boolean;
  num?: boolean;
  muted?: boolean;
  wrap?: boolean;
  render?: (row: T, i: number) => ReactNode;
}

export function DataTable<T>({
  columns, rows, dense = false, emphasize, rowKey = (_r: T, i: number) => i, onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  dense?: boolean;
  emphasize?: (row: T, i: number) => boolean;
  rowKey?: (row: T, i: number) => React.Key;
  onRowClick?: (row: T, i: number) => void;
}) {
  const rowPad = dense ? "6px 12px" : "9px 14px";
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontFamily: "var(--font-sans)", fontSize: 12.5,
      }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || "left",
                padding: rowPad,
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                fontWeight: 500, fontSize: 9.5,
                letterSpacing: "0.12em", textTransform: "uppercase",
                borderBottom: "1px solid var(--line-2)",
                background: "var(--panel)", whiteSpace: "nowrap",
                width: c.width,
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isEmph = emphasize && emphasize(r, i);
            const baseBg = isEmph ? "#FEF8E5" : "transparent";
            return (
              <tr key={rowKey(r, i)} onClick={onRowClick ? () => onRowClick(r, i) : undefined}
                style={{ cursor: onRowClick ? "pointer" : "default", background: baseBg }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--brand-10)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = baseBg)}
              >
                {columns.map((c, j) => (
                  <td key={j} style={{
                    textAlign: c.align || "left",
                    padding: rowPad,
                    color: c.muted ? "var(--ink-3)" : "var(--ink)",
                    fontSize: c.mono ? 11.5 : 12.5,
                    fontFamily: c.mono ? "var(--font-mono)" : "inherit",
                    letterSpacing: c.mono ? "0.01em" : "normal",
                    fontVariantNumeric: c.num ? "tabular-nums" : "normal",
                    borderBottom: "1px solid var(--line)",
                    whiteSpace: c.wrap ? "normal" : "nowrap",
                  }}>
                    {c.render ? c.render(r, i) : (c.key ? (r[c.key] as ReactNode) : null)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export function Button({ children, onClick, variant = "ghost", size = "md", icon, active }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);

  function getBg() {
    if (variant === "primary") return "var(--brand)";
    if (variant === "danger") {
      if (active) return "#A63300";
      return hover ? "#CF3F00" : "var(--sunset)";
    }
    if (hover || active) return "var(--slate-surface)";
    return "var(--paper)";
  }
  function getFg() {
    if (variant === "primary") return "#fff";
    if (variant === "danger") return "#fff";
    if (hover || active) return "var(--brand)";
    return "var(--ink)";
  }
  function getBorder() {
    if (variant === "primary") return "var(--brand)";
    if (variant === "danger") return active ? "#A63300" : "var(--sunset)";
    if (hover || active) return "var(--brand)";
    return "var(--line-2)";
  }

  const pad = size === "sm" ? "4px 10px" : "7px 14px";
  const fs = size === "sm" ? 11.5 : 12.5;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: pad, fontSize: fs, fontWeight: 500,
        fontFamily: "var(--font-sans)",
        background: getBg(), color: getFg(), border: `1px solid ${getBorder()}`,
        borderRadius: 4, cursor: "pointer",
        letterSpacing: "0.01em",
        transition: "all 180ms ease",
      }}
    >{icon}{children}</button>
  );
}
