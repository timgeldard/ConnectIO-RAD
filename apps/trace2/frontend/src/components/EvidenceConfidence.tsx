/* eslint-disable jsdoc/require-jsdoc */
import React from "react";
import type { Batch, CountryRow, CustomerRow, Delivery, MassBalanceEvent } from "../types";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { traceCopy } from "../i18n/pageCopy";

/**
 * Results of the evidence confidence evaluation.
 */
export interface ConfidenceResult {
  /** The rated grade of the evidence dossier */
  grade: "COMPLETE" | "PARTIAL" | "MISSING" | "UNKNOWN";
  /** Evaluated score between 0 and 100 */
  score: number;
  /** List of gaps identified in the batch evidence */
  gaps: string[];
  /** Breakdown of completeness by individual evidence pack */
  details: {
    /** Upstream and downstream material flow lineage */
    lineage: "complete" | "partial" | "missing" | "unknown";
    /** Customer shipments and delivery logs */
    customers: "complete" | "partial" | "missing" | "unknown";
    /** Reconciled production, shipped, and adjusted balances */
    massBalance: "complete" | "partial" | "missing" | "unknown";
    /** Quality inspection lots and MIC checkpoints */
    quality: "complete" | "partial" | "missing" | "unknown";
    /** Certificate of Analysis release document */
    coa: "complete" | "partial" | "missing" | "unknown";
    /** Raw ingredient source suppliers */
    suppliers: "complete" | "partial" | "missing" | "unknown";
  };
}

/**
 * Core utility function to evaluate the completeness of batch evidence.
 * 
 * @param batch - Suspect batch header details.
 * @param deliveries - List of customer shipment events.
 * @param mbEvents - Mass balance ledger entries.
 * @param countries - Target shipping countries.
 * @param customers - exposed top customer rows.
 * @returns The structured confidence grading result.
 */
export function calculateConfidence(
  batch: Batch,
  deliveries: Delivery[],
  mbEvents: MassBalanceEvent[],
  countries: CountryRow[],
  customers: CustomerRow[]
): ConfidenceResult {
  let score = 0;
  const gaps: string[] = [];
  
  const details: ConfidenceResult["details"] = {
    lineage: "unknown",
    customers: "unknown",
    massBalance: "unknown",
    quality: "unknown",
    coa: "unknown",
    suppliers: "unknown",
  };

  // 1. Lineage Verification (Max: 15 pts)
  if (batch.process_order) {
    details.lineage = "complete";
    score += 15;
  } else {
    details.lineage = "missing";
    gaps.push("Missing upstream process order lineage trace.");
  }

  // 2. Customers & Deliveries Verification (Max: 20 pts)
  if (batch.qty_shipped > 0) {
    if (deliveries.length > 0) {
      const sumDelivered = deliveries.reduce((acc, d) => acc + d.qty, 0);
      const differencePct = Math.abs(sumDelivered - batch.qty_shipped) / batch.qty_shipped;
      
      if (differencePct < 0.05) {
        details.customers = "complete";
        score += 20;
      } else {
        details.customers = "partial";
        score += 10;
        gaps.push(`Delivery log volume discrepancy of ${(differencePct * 100).toFixed(0)}% vs shipped quantity.`);
      }
    } else {
      details.customers = "missing";
      gaps.push("Suspect batch has shipped stock, but customer delivery records are empty.");
    }
  } else {
    // If no stock was shipped, the customer record is complete by default (contained)
    details.customers = "complete";
    score += 20;
  }

  // 3. Mass Balance Verification (Max: 20 pts)
  if (mbEvents.length > 0) {
    if (Math.abs(batch.variance || 0) < 0.01) {
      details.massBalance = "complete";
      score += 20;
    } else {
      details.massBalance = "partial";
      score += 10;
      gaps.push(`Mass balance variance of ${batch.variance} ${batch.uom} remains unresolved.`);
    }
  } else {
    details.massBalance = "missing";
    gaps.push("Mass balance ledger timeline is empty.");
  }

  // 4. Quality Inspection Verification (Max: 15 pts)
  if (batch.batch_status && batch.batch_status !== "UNKNOWN") {
    details.quality = "complete";
    score += 15;
  } else {
    details.quality = "missing";
    gaps.push("Suspect batch lacks a registered quality batch status.");
  }

  // 5. CoA Availability (Max: 15 pts)
  if (["RELEASED", "UNRESTRICTED", "RESTRICTED"].includes(batch.batch_status)) {
    details.coa = "complete";
    score += 15;
  } else if (["QUALITY_INSPECTION", "Q_INSP", "IN_PROC"].includes(batch.batch_status)) {
    details.coa = "partial";
    score += 8;
    gaps.push("Certificate of Analysis is pending inspection release.");
  } else {
    details.coa = "missing";
    gaps.push("Certificate of Analysis is withheld due to blocked batch status.");
  }

  // 6. Upstream Supplier Validation (Max: 15 pts)
  if (batch.plant_id && batch.plant_name) {
    details.suppliers = "complete";
    score += 15;
  } else {
    details.suppliers = "missing";
    gaps.push("Manufacturing plant validation is missing.");
  }

  // Deduce overall Grade
  let grade: ConfidenceResult["grade"] = "UNKNOWN";
  if (score === 100 && gaps.length === 0) {
    grade = "COMPLETE";
  } else if (score >= 50) {
    grade = "PARTIAL";
  } else {
    grade = "MISSING";
  }

  return { grade, score, gaps, details };
}

/**
 * Props for the EvidenceConfidenceBadge component.
 */
export interface EvidenceConfidenceBadgeProps {
  /** Structured confidence grading results */
  result: ConfidenceResult;
  /** Optional visual style overrides */
  style?: React.CSSProperties;
}

/**
 * A premium design-system badge rendering the calculated evidence confidence score and rating.
 * 
 * Provides an interactive hover description listing gaps and detailed grading breakdowns.
 * Meets Kerry custom design token standards.
 */
export function EvidenceConfidenceBadge({ result, style }: EvidenceConfidenceBadgeProps) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  
  const config = {
    COMPLETE: {
      color: "var(--jade)",
      bg: "var(--jade-surface)",
      border: "1px solid var(--jade-line)",
      label: copy.maturity.complete,
      desc: copy.maturity.confidenceDescComplete,
      bullet: "🟢",
    },
    PARTIAL: {
      color: "var(--sunrise)",
      bg: "var(--sunrise-surface)",
      border: "1px solid var(--sunrise-line)",
      label: copy.maturity.partial,
      desc: copy.maturity.confidenceDescPartial,
      bullet: "🟡",
    },
    MISSING: {
      color: "var(--sunset)",
      bg: "var(--sunset-surface)",
      border: "1px solid var(--sunset-line)",
      label: copy.maturity.missing,
      desc: copy.maturity.confidenceDescMissing,
      bullet: "🔴",
    },
    UNKNOWN: {
      color: "var(--ink-3)",
      bg: "var(--surface-sunken)",
      border: "1px solid var(--line-1)",
      label: copy.maturity.notAssessed,
      desc: copy.maturity.confidenceDescUnknown,
      bullet: "⚪",
    },
  }[result.grade];

  return (
    <div 
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 4,
        background: config.bg,
        border: config.border,
        color: config.color,
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 600,
        ...style
      }}
      title={`${config.label} (${result.score}%) — ${config.desc}`}
    >
      <span style={{ fontSize: 10 }}>{config.bullet}</span>
      <span>{copy.maturity.evidenceConfidenceLabel}:</span>
      <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{result.score}%</span>
      <span style={{ fontWeight: 400, opacity: 0.8 }}>({config.label})</span>
    </div>
  );
}
