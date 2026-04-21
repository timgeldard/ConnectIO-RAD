import { useState } from "react";
import type { Batch, RecallEvent } from "../types";
import { COUNTRIES, CUSTOMERS, DELIVERIES, EXPOSURE, RECALL_EVENTS } from "../data/mock";
import {
  BarChart, Button, Card, DataTable, Donut, KPI,
  SectionHeader, StatusPill, flag, fmtN,
} from "../ui";

export function PageRecallReadiness({ batch }: { batch: Batch }) {
  const [riskFilter, setRiskFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">("ALL");
  const [recallMode, setRecallMode] = useState(false);

  const filteredExposure = riskFilter === "ALL" ? EXPOSURE : EXPOSURE.filter((e) => e.risk === riskFilter);
  const exposedBatches = EXPOSURE.length;
  const criticalBatches = EXPOSURE.filter((e) => e.risk === "CRITICAL").length;
  const highRiskShipped = EXPOSURE.filter((e) => e.risk === "CRITICAL" || e.risk === "HIGH").reduce((s, e) => s + e.shipped, 0);
  const exposedStock = EXPOSURE.reduce((s, e) => s + e.stock, 0);
  const exposedCustomers = new Set(DELIVERIES.map((d) => d.customer)).size;

  return (
    <div>
      <SectionHeader
        eyebrow="01 — RECALL READINESS"
        title="If this batch were recalled today, where would it land?"
        subtitle="All downstream consumption, transfers and customer shipments that inherit material from this batch, with risk-tiered exposure and a reconstructable event timeline."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="md" icon={<span>⎙</span>}>Export dossier</Button>
            <Button variant="danger" size="md" onClick={() => setRecallMode(!recallMode)} active={recallMode}>
              {recallMode ? "Cancel simulation" : "Simulate recall"}
            </Button>
          </div>
        }
      />

      {recallMode && (
        <div style={{
          marginBottom: 20, padding: "14px 18px",
          background: "oklch(96% 0.02 35)",
          border: "1px solid oklch(55% 0.13 40)",
          borderRadius: 2,
          display: "flex", alignItems: "center", gap: 14,
          fontFamily: "'Inter', sans-serif", fontSize: 13, color: "var(--ink)",
        }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: "oklch(55% 0.13 40)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>!</div>
          <div style={{ flex: 1 }}>
            <strong>Simulation mode.</strong> The risk tiers below reflect the downstream blast radius if a recall is triggered at <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{batch.manufacture_date}</span>. No production systems are affected.
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em" }}>DRY-RUN · SANDBOX</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 12 }}>
        <KPI label="Batch status" value={<StatusPill status={batch.batch_status} />} />
        <KPI label="Days to expiry" value={batch.days_to_expiry} unit="days" sub={batch.manufacture_date + " → " + batch.expiry_date} />
        <KPI label="Unrestricted" value={fmtN(batch.unrestricted, 1)} unit="KG" tone="good" />
        <KPI label="Blocked" value={fmtN(batch.blocked, 0)} unit="KG" tone={batch.blocked > 0 ? "bad" : "muted"} />
        <KPI label="Quality inspection" value={fmtN(batch.qi, 0)} unit="KG" tone={batch.qi > 0 ? "warn" : "muted"} />
        <KPI label="Process order" value={<span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>{batch.process_order}</span>} sub={batch.plant_name} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 28 }}>
        <KPI label="Customers affected" value={batch.customers_affected} tone={recallMode ? "bad" : "default"} />
        <KPI label="Countries affected" value={batch.countries_affected} tone={recallMode ? "bad" : "default"} />
        <KPI label="Total shipped" value={fmtN(batch.total_shipped_kg, 1)} unit="KG" tone={recallMode ? "bad" : "default"} />
        <KPI label="Deliveries" value={batch.total_deliveries} />
        <KPI label="Consumed internally" value={fmtN(batch.total_consumed, 1)} unit="KG" />
        <KPI label="Consuming POs" value={batch.consuming_pos} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        <Card title="Shipped volume by country" subtitle="Where material from this batch has landed">
          <BarChart data={COUNTRIES} valueKey="qty" labelKey="name" height={280}
            color="oklch(42% 0.07 155)" format={(v) => fmtN(v, 0) + " KG"}
          />
        </Card>

        <Card title="Despatched by customer" subtitle="Share of total shipped quantity">
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Donut data={CUSTOMERS.slice(0, 8)} valueKey="qty" labelKey="name" size={200}
              centerValue={fmtN(batch.total_shipped_kg, 0)} centerLabel="KG DESPATCHED"
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {CUSTOMERS.slice(0, 8).map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Inter', sans-serif", fontSize: 11.5 }}>
                  <span style={{ width: 10, height: 10, background: ["oklch(48% 0.09 155)", "oklch(38% 0.06 155)", "oklch(58% 0.1 155)", "oklch(55% 0.13 40)", "oklch(65% 0.1 45)", "oklch(70% 0.12 75)", "oklch(55% 0.08 250)", "oklch(45% 0.06 250)"][i] }} />
                  <span style={{ flex: 1, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{(c.share * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Customer shipment events" subtitle={`${DELIVERIES.length} deliveries · sorted by date`} noPad style={{ marginBottom: 28 }}>
        <DataTable columns={[
          { header: "Delivery", key: "delivery", mono: true },
          { header: "Customer", key: "customer" },
          { header: "Destination", key: "destination", muted: true },
          { header: "Country", mono: true, render: (r) => <span>{flag(r.country)} {r.country}</span> },
          { header: "Date", key: "date", mono: true, muted: true },
          { header: "Qty (KG)", align: "right", mono: true, num: true, render: (r) => fmtN(r.qty, 1) },
          { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
          { header: "Doc", key: "doc", mono: true, muted: true },
        ]} rows={DELIVERIES}
          emphasize={(r) => recallMode && r.status !== "PLANNED"}
        />
      </Card>

      <SectionHeader
        eyebrow="BLAST RADIUS"
        title="Cross-batch exposure"
        subtitle="All batches that consumed material from this one. Tier 1 are direct descendants; Tier 2 are finished goods already in market."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <KPI label="Exposed batches" value={exposedBatches} tone={recallMode ? "bad" : "default"} />
        <KPI label="Critical tier" value={criticalBatches} tone={recallMode ? "bad" : "warn"} />
        <KPI label="High-risk shipped" value={fmtN(highRiskShipped, 0)} unit="KG" tone={recallMode ? "bad" : "warn"} />
        <KPI label="Exposed stock" value={fmtN(exposedStock, 0)} unit="KG" />
        <KPI label="Exposed customers" value={exposedCustomers} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Filter by risk:</span>
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as const).map((r) => (
          <Button key={r} variant="ghost" size="sm" active={riskFilter === r} onClick={() => setRiskFilter(r)}>{r}</Button>
        ))}
      </div>

      <Card noPad style={{ marginBottom: 28 }}>
        <DataTable columns={[
          { header: "Material", key: "material" },
          { header: "Batch", key: "batch", mono: true },
          { header: "Plant", key: "plant", mono: true, muted: true },
          { header: "Qty", align: "right", mono: true, num: true, render: (r) => fmtN(r.qty, 0) + " KG" },
          { header: "In stock", align: "right", mono: true, num: true, render: (r) => fmtN(r.stock, 0) },
          { header: "Shipped", align: "right", mono: true, num: true, render: (r) => fmtN(r.shipped, 0) },
          { header: "Depth", align: "center", mono: true, render: (r) => "L" + r.path_depth },
          { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
          { header: "Risk", render: (r) => <StatusPill status={r.risk} size="sm" /> },
        ]} rows={filteredExposure}
          emphasize={(r) => recallMode && (r.risk === "CRITICAL" || r.risk === "HIGH")}
        />
      </Card>

      <Card title="Batch movement timeline" subtitle="Reconstructs every posting that moved material from this batch — ready for regulatory submission">
        <MovementTimeline events={RECALL_EVENTS} />
      </Card>
    </div>
  );
}

function MovementTimeline({ events }: { events: RecallEvent[] }) {
  const categoryColor: Record<string, string> = {
    PRODUCTION: "oklch(48% 0.09 155)",
    CONSUMPTION: "oklch(55% 0.08 250)",
    SALES_ISSUE: "oklch(55% 0.13 40)",
    ADJUSTMENT: "oklch(70% 0.12 75)",
  };
  const maxMag = Math.max(...events.map((e) => Math.abs(e.qty)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {events.map((e, i) => {
        const pct = (Math.abs(e.qty) / maxMag) * 100;
        const positive = e.qty > 0;
        return (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "90px 160px 1fr 100px",
            gap: 14, alignItems: "center",
            padding: "10px 0", borderBottom: i === events.length - 1 ? "none" : "1px solid var(--line)",
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "var(--ink-2)" }}>{e.date}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: categoryColor[e.category] }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: "var(--ink)", textTransform: "capitalize" }}>
                {e.category.replace("_", " ").toLowerCase()}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--ink-3)" }}>{e.type}</span>
            </div>
            <div style={{ position: "relative", height: 18 }}>
              <div style={{
                position: "absolute", top: 6, height: 6,
                left: positive ? "50%" : `${50 - pct / 2}%`,
                width: `${pct / 2}%`,
                background: categoryColor[e.category],
                opacity: 0.75,
              }} />
              <div style={{ position: "absolute", top: 0, left: "50%", bottom: 0, width: 1, background: "var(--line-2)" }} />
              <div style={{
                position: "absolute", top: 0,
                left: positive ? `${50 + pct / 2 + 1}%` : `${50 - pct / 2 - 1}%`,
                transform: positive ? "none" : "translateX(-100%)",
                fontFamily: "'Inter', sans-serif", fontSize: 11, color: "var(--ink-2)",
              }}>
                {e.customer || e.plant}{e.country ? ` · ${e.country}` : ""}
              </div>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
              fontVariantNumeric: "tabular-nums", textAlign: "right",
              color: positive ? "oklch(38% 0.07 155)" : "oklch(42% 0.14 35)",
            }}>
              {positive ? "+" : ""}{fmtN(e.qty, 1)} {e.uom}
            </div>
          </div>
        );
      })}
    </div>
  );
}
