/* eslint-disable jsdoc/require-jsdoc */
import React, { useState, useEffect } from "react";
import type { ConfidenceResult } from "./EvidenceConfidence";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { traceCopy } from "../i18n/pageCopy";

/**
 * Props for the EvidencePackReadiness component.
 */
export interface EvidencePackReadinessProps {
  /** Evaluation results of evidence confidence */
  confidence: ConfidenceResult;
  /** Optional container style overrides */
  style?: React.CSSProperties;
}

/**
 * An interactive dossier checklist component showing the completeness and verification state
 * of all 6 core food safety evidence packs.
 * 
 * Quality leads can manually verify/toggle evidence sectors, view progress, and digitally compile the pack.
 */
export function EvidencePackReadiness({ confidence, style }: EvidencePackReadinessProps) {
  const { language } = useI18n();
  const copy = traceCopy(language);

  // Core sectors based on data loading confidence
  const initialSectors = [
    { id: "lineage", label: copy.maturity.lineageCheck, autoCompleted: confidence.details.lineage === "complete" },
    { id: "customers", label: copy.maturity.customerCheck, autoCompleted: confidence.details.customers === "complete" },
    { id: "massBalance", label: copy.maturity.massCheck, autoCompleted: confidence.details.massBalance === "complete" },
    { id: "quality", label: copy.maturity.qualityCheck, autoCompleted: confidence.details.quality === "complete" },
    { id: "coa", label: copy.maturity.coaCheck, autoCompleted: confidence.details.coa === "complete" },
    { id: "suppliers", label: copy.maturity.supplierCheck, autoCompleted: confidence.details.suppliers === "complete" },
  ];

  // Keep track of manual QA override checkmarks
  const [checkedSectors, setCheckedSectors] = useState<Record<string, boolean>>({});
  const [dossierCompiled, setDossierCompiled] = useState(false);

  // Sync automatic checkmarks from the calculated payload
  useEffect(() => {
    const nextChecks: Record<string, boolean> = {};
    initialSectors.forEach((s) => {
      nextChecks[s.id] = s.autoCompleted;
    });
    setCheckedSectors(nextChecks);
    setDossierCompiled(false);
  }, [confidence]);

  const handleToggle = (id: string) => {
    if (dossierCompiled) return;
    setCheckedSectors((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const totalSectors = initialSectors.length;
  const verifiedCount = Object.values(checkedSectors).filter(Boolean).length;
  const percentCompleted = Math.round((verifiedCount / totalSectors) * 100);
  const isFullyReady = verifiedCount === totalSectors;

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "24px 28px",
        boxShadow: "0 1px 4px rgba(20,55,0,0.04)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--forest)", fontWeight: 600 }}>
          {copy.maturity.evidencePackTitle}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}>
          {copy.maturity.evidencePackSubtitle}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{copy.maturity.progress}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--brand)" }}>
            {verifiedCount} / {totalSectors} ({percentCompleted}%)
          </span>
        </div>
        <div style={{ height: 10, background: "var(--panel)", borderRadius: 5, overflow: "hidden", display: "flex" }}>
          <div
            style={{
              width: `${percentCompleted}%`,
              height: "100%",
              background: isFullyReady ? "var(--jade)" : "var(--brand)",
              transition: "width 0.3s ease, background-color 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Checklist Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {initialSectors.map((s) => {
          const isChecked = !!checkedSectors[s.id];
          return (
            <div
              key={s.id}
              onClick={() => handleToggle(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                border: `1px solid ${isChecked ? "var(--line-1)" : "var(--line-2)"}`,
                background: isChecked ? "var(--surface-0)" : "var(--surface-sunken)",
                borderRadius: 6,
                cursor: dossierCompiled ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {}} // Controlled by outer div click
                disabled={dossierCompiled}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: "var(--brand)",
                  cursor: dossierCompiled ? "not-allowed" : "pointer",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: isChecked ? "var(--ink)" : "var(--ink-3)",
                  fontWeight: isChecked ? 500 : 400,
                  textDecoration: isChecked && dossierCompiled ? "line-through" : "none",
                }}
              >
                {s.label}
              </span>
              {s.autoCompleted && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--jade)",
                    background: "var(--jade-surface)",
                    padding: "1px 5px",
                    borderRadius: 3,
                    textTransform: "uppercase",
                  }}
                >
                  System Verified
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Action Button */}
      {dossierCompiled ? (
        <div
          style={{
            padding: "14px 18px",
            background: "var(--jade-surface)",
            border: "1px solid var(--jade-line)",
            borderRadius: 6,
            textAlign: "center",
            color: "var(--jade)",
            fontWeight: 600,
            fontSize: 14,
            animation: "fadeIn 0.4s ease",
          }}
        >
          ✓ {copy.maturity.dossierCompiled} & Digitally Signed by Kerry QA
        </div>
      ) : (
        <button
          onClick={() => {
            if (isFullyReady) setDossierCompiled(true);
          }}
          disabled={!isFullyReady}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: isFullyReady ? "var(--jade)" : "var(--line-2)",
            color: isFullyReady ? "#fff" : "var(--ink-3)",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 14,
            cursor: isFullyReady ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
        >
          {isFullyReady ? "Compile Evidence Dossier" : "Complete Verification to Compile"}
        </button>
      )}
    </div>
  );
}
