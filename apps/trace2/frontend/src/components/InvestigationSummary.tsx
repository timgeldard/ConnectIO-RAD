/* eslint-disable jsdoc/require-jsdoc */
import React from "react";
import type { Batch, CountryRow, CustomerRow, Delivery, MassBalanceEvent, PageId } from "../types";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { traceCopy } from "../i18n/pageCopy";
import { EvidenceConfidenceBadge, type ConfidenceResult } from "./EvidenceConfidence";
import { Button, StatusPill, fmtN, fmtInt } from "../ui";

/**
 * Props for the InvestigationSummary component.
 */
export interface InvestigationSummaryProps {
  /** The focal batch header details */
  batch: Batch;
  /** List of deliveries made from this batch */
  deliveries: Delivery[];
  /** Mass balance events ledger */
  mbEvents: MassBalanceEvent[];
  /** Top countries reached by this batch */
  countries: CountryRow[];
  /** Top customers exposed to this batch */
  customers: CustomerRow[];
  /** Callback to navigate between cockpit pages */
  navigate: (id: PageId) => void;
  /** Pre-calculated evidence confidence assessment */
  confidence: ConfidenceResult;
  /** Is the recall simulation currently active */
  sim: boolean;
  /** Callback to toggle the recall simulation mode */
  onSim: (sim: boolean) => void;
}

/**
 * Premium, information-dense Case Header component that consolidates
 * critical traceability, quality, shelf-life, and exposure data.
 * 
 * Renders dynamic severity indicators, recommended actions, and clear navigation hooks.
 */
export function InvestigationSummary({
  batch,
  deliveries,
  mbEvents,
  countries,
  customers,
  navigate,
  confidence,
  sim,
  onSim,
}: {
  batch: Batch;
  deliveries: Delivery[];
  mbEvents: MassBalanceEvent[];
  countries: CountryRow[];
  customers: CustomerRow[];
  navigate: (id: PageId) => void;
  confidence: ConfidenceResult;
  sim: boolean;
  onSim: (v: boolean) => void;
}) {
  const { language } = useI18n();
  const copy = traceCopy(language);

  // Dynamic Exposure Severity & Alerts
  const hasShippedExposure = batch.customers_affected > 0 || batch.qty_shipped > 0;
  const isNearExpiry = batch.days_to_expiry >= 0 && batch.days_to_expiry < 30;
  const isExpired = batch.days_to_expiry < 0;
  const hasUnrestrictedStock = batch.unrestricted > 0;

  let severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  let alertMessage = copy.maturity.noExposureAlert;
  let actionGuidance = copy.maturity.actionReview;
  let bannerColor = "var(--jade)";
  let bannerBg = "var(--jade-surface)";
  let bannerBorder = "1px solid var(--jade-line)";

  if (hasShippedExposure) {
    severity = "CRITICAL";
    alertMessage = copy.maturity.criticalExposureAlert;
    actionGuidance = copy.maturity.actionRecall;
    bannerColor = "var(--sunset)";
    bannerBg = "var(--sunset-surface)";
    bannerBorder = "1px solid var(--sunset-line)";
  } else if (isExpired || isNearExpiry) {
    severity = "HIGH";
    alertMessage = copy.maturity.expiryAlert;
    actionGuidance = copy.maturity.actionMonitor;
    bannerColor = "var(--sunrise)";
    bannerBg = "var(--sunrise-surface)";
    bannerBorder = "1px solid var(--sunrise-line)";
  } else if (hasUnrestrictedStock && ["QUALITY_INSPECTION", "Q_INSP", "BLOCKED"].includes(batch.batch_status)) {
    severity = "MEDIUM";
    alertMessage = copy.maturity.stockAlert;
    actionGuidance = copy.maturity.actionMonitor;
    bannerColor = "var(--sunrise)";
    bannerBg = "var(--sunrise-surface)";
    bannerBorder = "1px solid var(--sunrise-line)";
  }

  const severityLabel = {
    CRITICAL: copy.maturity.criticalExposure,
    HIGH: copy.maturity.highRiskExpiry,
    MEDIUM: copy.maturity.mediumRisk,
    LOW: copy.maturity.lowRisk,
  }[severity];

  return (
    <div 
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "24px 28px",
        marginBottom: 28,
        boxShadow: "0 2px 8px rgba(20,55,0,0.04)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Top row: Case Details & Confidence Badge */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid var(--line-1)",
          paddingBottom: 16,
          marginBottom: 18,
          gap: 20
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span 
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ink-3)",
                letterSpacing: "0.14em",
                textTransform: "uppercase"
              }}
            >
              Batch Investigation Cockpit
            </span>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--line-2)" }} />
            <EvidenceConfidenceBadge result={confidence} />
          </div>
          
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "var(--forest)" }}>
            {batch.material_desc40 || batch.material_name}
            <span 
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: "var(--ink-2)",
                fontWeight: 400,
                marginLeft: 12
              }}
            >
              (Mat: {batch.material_id} · Batch: {batch.batch_id})
            </span>
          </h2>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button 
            variant="danger" 
            size="md" 
            active={sim} 
            onClick={() => onSim(!sim)}
          >
            {sim ? copy.recall.cancelSimulation : copy.recall.simulateRecall}
          </Button>
        </div>
      </div>

      {/* Case Severity & Action Alert Banner */}
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 18px",
          background: bannerBg,
          border: bannerBorder,
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 13,
          color: "var(--ink)",
        }}
      >
        <span 
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            fontWeight: 700,
            textTransform: "uppercase",
            color: bannerColor,
            background: "rgba(255, 255, 255, 0.4)",
            padding: "2px 6px",
            borderRadius: 3
          }}
        >
          {severityLabel}
        </span>
        <div style={{ flex: 1 }}>
          <strong>{copy.maturity.actionNeeded}:</strong> {alertMessage} <br />
          <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{actionGuidance}</span>
        </div>
      </div>

      {/* Grid of Key Analytical Metrics */}
      <div 
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 16,
          background: "var(--panel)",
          borderRadius: 6,
          padding: "16px 20px",
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            {copy.maturity.stockPosition}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            {fmtInt(batch.current_stock)}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-2)", marginLeft: 4 }}>{batch.uom}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>
            {fmtInt(batch.unrestricted)} unrestricted
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            Total Shipped
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: hasShippedExposure ? "var(--sunset)" : "var(--ink)" }}>
            {fmtInt(batch.total_shipped_kg)}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-2)", marginLeft: 4 }}>{batch.uom}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>
            {batch.total_deliveries} direct deliveries
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            Internal Consumption
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            {fmtInt(batch.total_consumed)}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-2)", marginLeft: 4 }}>{batch.uom}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>
            feeds {batch.consuming_pos} process orders
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            Downstream Exposure
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: hasShippedExposure ? "var(--sunset)" : "var(--ink)" }}>
            {batch.customers_affected}
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-2)", marginLeft: 4 }}>customers</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>
            across {batch.countries_affected} countries
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            Shelf Life
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: isExpired ? "var(--sunset)" : isNearExpiry ? "var(--sunrise)" : "var(--jade)" }}>
            {batch.days_to_expiry >= 0 ? `${fmtInt(batch.days_to_expiry)} days` : copy.maturity.expired}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>
            expires {batch.expiry_date}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
            Quality Status
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            <StatusPill status={batch.batch_status} size="sm" />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>
            produced in {batch.plant_id}
          </div>
        </div>
      </div>

      {/* Bottom Pointers & Quick Links */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "var(--ink-2)",
          borderTop: "1px solid var(--line-1)",
          paddingTop: 14,
        }}
      >
        <span>
          💡 <strong>Auditing checklist:</strong> ensure all data sectors match the physical SAP delivery notes before signing release forms.
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span>Explore pages:</span>
          {[
            { label: "Mass Balance", target: "mass_balance" as PageId },
            { label: "Lineage Graph", target: "bottom_up" as PageId },
            { label: "CoA Lot", target: "coa" as PageId },
            { label: "Deliveries", target: "customers_deliveries" as PageId }
          ].map((l) => (
            <button
              key={l.target}
              onClick={() => navigate(l.target)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--brand)",
                cursor: "pointer",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              {l.label} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
