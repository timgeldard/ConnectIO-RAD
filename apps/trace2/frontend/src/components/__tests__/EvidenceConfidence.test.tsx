/* eslint-disable jsdoc/require-jsdoc */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { calculateConfidence, EvidenceConfidenceBadge } from "../EvidenceConfidence";
import { EvidencePackReadiness } from "../EvidencePackReadiness";
import type { Batch, Delivery, MassBalanceEvent } from "../../types";

describe("calculateConfidence Data Grading Logic", () => {
  const baseBatch: Batch = {
    material_id: "MAT01",
    batch_id: "BAT99",
    material_desc40: "Suspect Whey Powder",
    material_name: "Suspect Whey Powder",
    plant_id: "PL05",
    plant_name: "Charleville",
    process_order: "PO100023",
    manufacture_date: "2026-01-01",
    expiry_date: "2026-12-31",
    days_to_expiry: 300,
    uom: "KG",
    qty_produced: 5000,
    unrestricted: 5000,
    qty_shipped: 0,
    qty_consumed: 0,
    customers_affected: 0,
    countries_affected: 0,
    batch_status: "RELEASED",
    total_deliveries: 0,
    total_shipped_kg: 0,
    current_stock: 5000,
  };

  const baseDeliveries: Delivery[] = [];
  const baseMbEvents: MassBalanceEvent[] = [
    { date: "2026-01-01", type: "PROD", qty: 5000, cum: 5000 },
  ];

  it("grades as COMPLETE with 100% score when all core evidence packs are verified and populated", () => {
    const result = calculateConfidence(baseBatch, baseDeliveries, baseMbEvents, [], []);
    expect(result.grade).toBe("COMPLETE");
    expect(result.score).toBe(100);
    expect(result.gaps.length).toBe(0);
  });

  it("grades as PARTIAL when mass balance has a variance discrepancy", () => {
    const imperfectBatch = { ...baseBatch, variance: 25.5 };
    const result = calculateConfidence(imperfectBatch, baseDeliveries, baseMbEvents, [], []);
    expect(result.grade).toBe("PARTIAL");
    expect(result.score).toBe(90); // 100 - 10 (variance mismatch)
    expect(result.gaps).toContain("Mass balance variance of 25.5 KG remains unresolved.");
  });

  it("grades as MISSING when critical parts are completely empty", () => {
    const emptyBatch = { ...baseBatch, process_order: "", batch_status: "UNKNOWN" };
    const result = calculateConfidence(emptyBatch, [], [], [], []);
    expect(result.grade).toBe("MISSING");
    expect(result.score).toBe(35); // Very low score
    expect(result.gaps).toContain("Missing upstream process order lineage trace.");
    expect(result.gaps).toContain("Mass balance ledger timeline is empty.");
  });
});

describe("EvidenceConfidenceBadge UI", () => {
  it("renders a Complete status correctly", () => {
    const result = {
      grade: "COMPLETE" as const,
      score: 100,
      gaps: [],
      details: {
        lineage: "complete" as const,
        customers: "complete" as const,
        massBalance: "complete" as const,
        quality: "complete" as const,
        coa: "complete" as const,
        suppliers: "complete" as const,
      },
    };

    render(<EvidenceConfidenceBadge result={result} />);
    expect(screen.getByText("Evidence Confidence:")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("(Complete)")).toBeInTheDocument();
  });
});

describe("EvidencePackReadiness Checklist", () => {
  const sampleConfidence = {
    grade: "PARTIAL" as const,
    score: 75,
    gaps: ["Discrepancies found"],
    details: {
      lineage: "complete" as const,
      customers: "missing" as const,
      massBalance: "complete" as const,
      quality: "complete" as const,
      coa: "complete" as const,
      suppliers: "complete" as const,
    },
  };

  it("renders checked items based on system analysis", () => {
    render(<EvidencePackReadiness confidence={sampleConfidence} />);
    
    // Lineage check is auto-completed by system
    expect(screen.getByText("Lineage map loaded")).toBeInTheDocument();
    expect(screen.getAllByText("System Verified").length).toBeGreaterThan(0);
  });

  it("disables compile button until all items are fully checked", () => {
    render(<EvidencePackReadiness confidence={sampleConfidence} />);
    
    const compileBtn = screen.getByRole("button", { name: /Complete Verification to Compile/i });
    expect(compileBtn).toBeDisabled();
  });

  it("permits toggling unchecked items manually and compiling once fully checked", () => {
    render(<EvidencePackReadiness confidence={sampleConfidence} />);
    
    // Toggle the customer check manually (which is currently missing)
    const customerRow = screen.getByText("Customer & delivery records available");
    fireEvent.click(customerRow);

    // After manual check, all 6 items are checked! Compile button is active
    const compileBtn = screen.getByRole("button", { name: /Compile Evidence Dossier/i });
    expect(compileBtn).toBeEnabled();

    // Click compile and check the signed dossier success message
    fireEvent.click(compileBtn);
    expect(screen.getByText(/Dossier Compiled & Digitally Signed by Kerry QA/i)).toBeInTheDocument();
  });
});
