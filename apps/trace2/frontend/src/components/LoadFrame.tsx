import type { ReactNode } from "react";
import { useI18n } from "@connectio/shared-frontend-i18n";
import type { LoadState } from "../data/useBatchData";

interface Props<T> {
  state: LoadState<T>;
  eyebrow: string;
  loadingTitle: string;
  loadingSubtitle?: string;
  children: (data: T) => ReactNode;
}

export function LoadFrame<T>({ state, eyebrow, loadingTitle, loadingSubtitle, children }: Props<T>) {
  const { t } = useI18n();
  if (state.kind === "loading") {
    return (
      <MessageBlock eyebrow={eyebrow} title={loadingTitle} subtitle={loadingSubtitle} />
    );
  }
  if (state.kind === "error") {
    const isNotFound = state.status === 404;
    return (
      <MessageBlock
        eyebrow={eyebrow}
        title={isNotFound ? t("trace.load.notFound") : t("trace.load.error")}
        subtitle={state.message}
      />
    );
  }
  return <>{children(state.data)}</>;
}

function MessageBlock({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "48px 0", fontFamily: "var(--font-sans)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 8 }}>
        {eyebrow}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)", marginBottom: 8 }}>
        {title}
      </div>
      {subtitle && <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{subtitle}</div>}
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
        color: "var(--ink-3)",
      }}
    >
      {message}
    </div>
  );
}
