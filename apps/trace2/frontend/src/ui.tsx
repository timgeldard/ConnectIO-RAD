import React, { CSSProperties, ReactNode, useState } from "react";

type TokenKey = string;

export const STATUS_TOKENS: Record<TokenKey, { label: string; fg: string; bg: string; dot: string }> = {
  UNRESTRICTED: { label: "Unrestricted", fg: "#1a3f2c", bg: "#e4ebe0", dot: "oklch(48% 0.09 155)" },
  QUALITY_INSPECTION: { label: "Quality inspection", fg: "#6b4a13", bg: "#f2e8cc", dot: "oklch(70% 0.12 75)" },
  Q_INSP: { label: "Quality inspection", fg: "#6b4a13", bg: "#f2e8cc", dot: "oklch(70% 0.12 75)" },
  RESTRICTED: { label: "Restricted", fg: "#6b4a13", bg: "#f2e8cc", dot: "oklch(70% 0.12 75)" },
  BLOCKED: { label: "Blocked", fg: "#6a2212", bg: "#ecd9d0", dot: "oklch(55% 0.13 40)" },
  IN_TRANSIT: { label: "In transit", fg: "#2c3f5e", bg: "#dde5ee", dot: "oklch(55% 0.08 250)" },
  DELIVERED: { label: "Delivered", fg: "#1a3f2c", bg: "#e4ebe0", dot: "oklch(48% 0.09 155)" },
  PLANNED: { label: "Planned", fg: "#4a4539", bg: "#ebe6d9", dot: "oklch(60% 0.02 80)" },
  RELEASED: { label: "Released", fg: "#1a3f2c", bg: "#e4ebe0", dot: "oklch(48% 0.09 155)" },
  IN_PROC: { label: "In production", fg: "#2c3f5e", bg: "#dde5ee", dot: "oklch(55% 0.08 250)" },
  ACCEPTED: { label: "Accepted", fg: "#1a3f2c", bg: "#e4ebe0", dot: "oklch(48% 0.09 155)" },
  REJECTED: { label: "Rejected", fg: "#6a2212", bg: "#ecd9d0", dot: "oklch(55% 0.13 40)" },
  LOW: { label: "Low risk", fg: "#1a3f2c", bg: "#e4ebe0", dot: "oklch(48% 0.09 155)" },
  MEDIUM: { label: "Medium risk", fg: "#6b4a13", bg: "#f2e8cc", dot: "oklch(70% 0.12 75)" },
  HIGH: { label: "High risk", fg: "#6a2212", bg: "#ecd9d0", dot: "oklch(55% 0.13 40)" },
  CRITICAL: { label: "Critical", fg: "#6a2212", bg: "#e4c8bf", dot: "oklch(48% 0.15 35)" },
  WITHIN_SHELF_LIFE: { label: "Within shelf life", fg: "#1a3f2c", bg: "#e4ebe0", dot: "oklch(48% 0.09 155)" },
};

export function StatusPill({ status, children, size = "md" }: { status: string; children?: ReactNode; size?: "sm" | "md" }) {
  const t = STATUS_TOKENS[status] || { label: status, fg: "#4a4539", bg: "#ebe6d9", dot: "oklch(60% 0.02 80)" };
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  const fs = size === "sm" ? 11 : 12;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: t.bg, color: t.fg,
      padding: pad, borderRadius: 999,
      fontSize: fs, fontWeight: 500,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: t.dot }} />
      {children || t.label}
    </span>
  );
}

type Tone = "default" | "good" | "warn" | "bad" | "muted";

export function KPI({ label, value, unit, sub, tone = "default", large = false }: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  large?: boolean;
}) {
  const tones: Record<Tone, { fg: string; accent: string }> = {
    default: { fg: "var(--ink)", accent: "var(--ink-2)" },
    good: { fg: "oklch(38% 0.07 155)", accent: "oklch(48% 0.09 155)" },
    warn: { fg: "oklch(48% 0.12 70)", accent: "oklch(68% 0.12 75)" },
    bad: { fg: "oklch(42% 0.14 35)", accent: "oklch(55% 0.13 40)" },
    muted: { fg: "var(--ink-2)", accent: "var(--ink-3)" },
  };
  const t = tones[tone];
  return (
    <div style={{
      padding: "16px 18px",
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: 4,
      display: "flex", flexDirection: "column", gap: 4,
      minHeight: large ? 104 : 88,
      justifyContent: "space-between",
    }}>
      <div style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, color: t.fg }}>
        <span style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: large ? 36 : 28,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>{value}</span>
        {unit && <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.02em",
        }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

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
      borderRadius: 4,
      display: "flex", flexDirection: "column",
      ...style,
    }}>
      {(title || action) && (
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid var(--line)",
          gap: 12,
        }}>
          <div>
            {title && <div style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 15, fontWeight: 500,
              letterSpacing: "-0.005em", color: "var(--ink)",
            }}>{title}</div>}
            {subtitle && <div style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11, color: "var(--ink-3)",
              marginTop: 2, letterSpacing: "0.01em",
            }}>{subtitle}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={{ padding: noPad ? 0 : padding, flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

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
  const rowPad = dense ? "8px 12px" : "11px 14px";
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12.5,
      }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || "left",
                padding: rowPad,
                color: "var(--ink-3)",
                fontWeight: 500, fontSize: 10.5,
                letterSpacing: "0.08em", textTransform: "uppercase",
                borderBottom: "1px solid var(--line-2)",
                background: "var(--card)", whiteSpace: "nowrap",
                width: c.width,
              }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isEmph = emphasize && emphasize(r, i);
            const baseBg = isEmph ? "oklch(96% 0.02 35 / 0.6)" : "transparent";
            return (
              <tr key={rowKey(r, i)} onClick={onRowClick ? () => onRowClick(r, i) : undefined}
                style={{ cursor: onRowClick ? "pointer" : "default", background: baseBg }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = baseBg)}
              >
                {columns.map((c, j) => (
                  <td key={j} style={{
                    textAlign: c.align || "left",
                    padding: rowPad,
                    color: c.muted ? "var(--ink-2)" : "var(--ink)",
                    fontSize: c.mono ? 12 : 12.5,
                    fontFamily: c.mono ? "'JetBrains Mono', ui-monospace, monospace" : "inherit",
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

export function BarChart<T extends Record<string, any>>({
  data, valueKey, labelKey, subKey, height, color = "oklch(48% 0.09 155)", max, showValue = true,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height }}>
      {rows.map((r, i) => {
        const pct = ((r[valueKey] as number) / m) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
            <div style={{ width: 160, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r[labelKey] as ReactNode}
              {subKey && <span style={{ color: "var(--ink-3)", marginLeft: 6, fontSize: 10.5 }}>{r[subKey] as ReactNode}</span>}
            </div>
            <div style={{ flex: 1, height: 10, background: "var(--line)", borderRadius: 0, position: "relative" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.6s cubic-bezier(0.2,0.8,0.2,1)" }} />
            </div>
            {showValue && <div style={{ width: 72, textAlign: "right", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{format(r[valueKey] as number)}</div>}
          </div>
        );
      })}
    </div>
  );
}

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
    "oklch(48% 0.09 155)", "oklch(38% 0.06 155)", "oklch(58% 0.1 155)",
    "oklch(55% 0.13 40)", "oklch(65% 0.1 45)", "oklch(70% 0.12 75)",
    "oklch(55% 0.08 250)", "oklch(45% 0.06 250)", "oklch(40% 0.05 300)",
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
            style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 22, fill: "var(--ink)", fontVariantNumeric: "tabular-nums" }}
          >{centerValue}</text>
          {centerLabel && <text x={cx} y={cy + 14} textAnchor="middle"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fill: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}
          >{centerLabel}</text>}
        </>
      )}
    </svg>
  );
}

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

export function ParamField({ label, value, mono = true, emphasize = false }: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 10, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : "'Inter', sans-serif",
        fontSize: emphasize ? 15 : 13,
        fontWeight: emphasize ? 500 : 400,
        color: "var(--ink)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle, action }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      marginBottom: 20, gap: 24,
    }}>
      <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
        {eyebrow && <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10.5, color: "var(--ink-3)",
          textTransform: "uppercase", letterSpacing: "0.14em",
          marginBottom: 6,
        }}>{eyebrow}</div>}
        <h1 style={{
          fontFamily: "'Newsreader', Georgia, serif",
          fontSize: 34, fontWeight: 400,
          letterSpacing: "-0.02em", lineHeight: 1.05,
          color: "var(--ink)", margin: 0,
        }}>{title}</h1>
        {subtitle && <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13.5, color: "var(--ink-2)",
          marginTop: 8, maxWidth: 680,
        }}>{subtitle}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "ghost", size = "md", icon, active }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const variants = {
    primary: { bg: "var(--ink)", fg: "var(--paper)", border: "var(--ink)" },
    ghost: { bg: hover || active ? "var(--hover)" : "transparent", fg: "var(--ink)", border: "var(--line-2)" },
    danger: { bg: hover ? "oklch(55% 0.13 40)" : "transparent", fg: hover ? "#fff" : "oklch(45% 0.13 35)", border: "oklch(55% 0.13 40)" },
  } as const;
  const v = variants[variant];
  const pad = size === "sm" ? "4px 10px" : "7px 14px";
  const fs = size === "sm" ? 11.5 : 12.5;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: pad, fontSize: fs, fontWeight: 500,
        fontFamily: "'Inter', sans-serif",
        background: v.bg, color: v.fg, border: `1px solid ${v.border}`,
        borderRadius: 2, cursor: "pointer",
        letterSpacing: "0.01em",
        transition: "all 120ms",
      }}
    >{icon}{children}</button>
  );
}
