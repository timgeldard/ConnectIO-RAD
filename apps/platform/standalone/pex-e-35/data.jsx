// =====================================================================
// PEX-E-35 — Process Order dataset + canonical status derivation
// ---------------------------------------------------------------------
// The dataset below holds RAW order facts (timestamps, flags, components).
// All status / exception logic is DERIVED from those facts via the
// pure functions at the bottom — never stored on the row directly.
// This is the heart of the PEX-E-35 enhancement: meaning over codes.
// =====================================================================

// "Now" = a fixed wall-clock for the demo so timestamps stay deterministic.
const NOW = new Date("2026-05-03T14:20:00Z").getTime();
const HOUR = 60 * 60 * 1000;

// ---------- helpers ----------
const hAgo = (h) => new Date(NOW - h * HOUR).toISOString();
const hAhead = (h) => new Date(NOW + h * HOUR).toISOString();
const fmtClock = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
};
const fmtRel = (iso) => {
  if (!iso) return "—";
  const diffH = (new Date(iso).getTime() - NOW) / HOUR;
  const abs = Math.abs(diffH);
  const unit = abs < 1 ? `${Math.round(abs * 60)}m` : abs < 24 ? `${abs.toFixed(1)}h` : `${(abs / 24).toFixed(1)}d`;
  return diffH < 0 ? `${unit} ago` : `in ${unit}`;
};

// ---------- master dataset ----------
// Plants, lines, materials in plausible Kerry naming.
const PLANTS = ["BEL01 · Beloit, WI", "ROC02 · Rochester, NY", "DBL03 · Dublin", "JKT04 · Jakarta"];
const LINES_BY_PLANT = {
  "BEL01 · Beloit, WI": ["L-101 Spray Dry", "L-102 Spray Dry", "L-201 Blend", "L-301 Pack"],
  "ROC02 · Rochester, NY": ["L-110 Liquid", "L-210 Blend A", "L-220 Blend B"],
  "DBL03 · Dublin": ["L-401 Powder", "L-402 Powder", "L-501 Pack"],
  "JKT04 · Jakarta": ["L-601 Wet", "L-602 Wet", "L-701 Pack"],
};

const MATERIALS = [
  { id: "TX-4421",  name: "Tastesense™ Sweet 4421",        family: "Taste" },
  { id: "TX-3380",  name: "Tastesense™ Salt 3380",         family: "Taste" },
  { id: "PH-1290",  name: "ProDiem™ Plant Protein Blend",  family: "Protein" },
  { id: "PH-1455",  name: "Wellmune® Beta-Glucan",         family: "ProactiveHealth" },
  { id: "PH-7702",  name: "GanedenBC30® Probiotic",        family: "ProactiveHealth" },
  { id: "BV-2210",  name: "Beverage Cloud Emulsion",       family: "Beverage" },
  { id: "DA-3104",  name: "Cultured Dairy Base 3104",      family: "Dairy" },
  { id: "FS-9020",  name: "Foodservice Coating 9020",      family: "Foodservice" },
  { id: "EM-5150",  name: "Yeast Extract YE-5150",         family: "Taste" },
  { id: "EM-5188",  name: "Mycoprotein Concentrate",       family: "Protein" },
];

// Build 84 orders with a wide spread of conditions
function makeDataset() {
  const orders = [];
  let n = 4_500_010;

  // Helper to push an order
  const push = (overrides) => {
    const m = MATERIALS[overrides._mIdx ?? Math.floor(Math.random() * MATERIALS.length)];
    const plant = overrides._plant ?? PLANTS[Math.floor(Math.random() * PLANTS.length)];
    const line = (LINES_BY_PLANT[plant])[Math.floor(Math.random() * LINES_BY_PLANT[plant].length)];
    const o = {
      orderId: String(n++),
      plant,
      line,
      materialId: m.id,
      materialName: m.name,
      materialFamily: m.family,
      qty: overrides.qty ?? Math.round((40 + Math.random() * 460) / 5) * 5,
      uom: "kg",
      plannedStart: overrides.plannedStart,
      plannedFinish: overrides.plannedFinish,
      actualStart: overrides.actualStart ?? null,
      actualFinish: overrides.actualFinish ?? null,
      techComplete: overrides.techComplete ?? false,
      // Component readiness — array of {id, name, required, issued, staged, picked, trCreated, required_to_stage}
      components: overrides.components ?? defaultComponents(m),
      // Has a logistics block (e.g. equipment/QC)
      nonMaterialBlock: overrides.nonMaterialBlock ?? null,
      progress: overrides.progress ?? null, // 0..1 if running/complete
      operator: overrides.operator ?? randomOperator(),
      orderType: overrides.orderType ?? "Process",
      ...overrides,
    };
    orders.push(o);
  };

  const dt = (planStartH, durH, opts = {}) => ({
    plannedStart: hAgo(-planStartH * -1) /* helper */ || hAgo(planStartH),
    plannedFinish: planStartH < 0 ? hAhead(-planStartH + durH) : hAgo(planStartH - durH),
  });
  // Simpler: do it directly per row.

  // ============== Curated rows that exercise every business-logic combo ==============

  // 1. Running smoothly, on track
  push({
    plannedStart: hAgo(2), plannedFinish: hAhead(4),
    actualStart: hAgo(1.8), progress: 0.32,
    components: stagedComponents(MATERIALS[2], 3),
    _plant: PLANTS[0],
  });

  // 2. CRITICAL: Running but staging never created (active risk)
  push({
    plannedStart: hAgo(0.3), plannedFinish: hAhead(5),
    actualStart: hAgo(0.2), progress: 0.05,
    components: notCreatedComponents(MATERIALS[3], 4),
    _plant: PLANTS[0],
  });

  // 3. Running with partial staging (TR created, picks incomplete)
  push({
    plannedStart: hAgo(1), plannedFinish: hAhead(3),
    actualStart: hAgo(0.8), progress: 0.18,
    components: trCreatedComponents(MATERIALS[5], 4, 0.5),
    _plant: PLANTS[1],
  });

  // 4. Late start (planned passed, not started, staging ready)
  push({
    plannedStart: hAgo(2.1), plannedFinish: hAhead(2),
    actualStart: null,
    components: stagedComponents(MATERIALS[0], 3),
    _plant: PLANTS[0],
  });

  // 5. Late finish (running past planned finish)
  push({
    plannedStart: hAgo(8), plannedFinish: hAgo(1),
    actualStart: hAgo(7.6), progress: 0.78,
    components: stagedComponents(MATERIALS[6], 4),
    _plant: PLANTS[2],
  });

  // 6. Not started + staged to line (ready but idle)
  push({
    plannedStart: hAhead(0.4), plannedFinish: hAhead(6),
    actualStart: null,
    components: stagedComponents(MATERIALS[1], 3),
    _plant: PLANTS[0],
  });

  // 7. Completed + TR still open (logistics lag)
  push({
    plannedStart: hAgo(10), plannedFinish: hAgo(2),
    actualStart: hAgo(9.5), actualFinish: hAgo(1.5), progress: 1.0,
    components: trCreatedComponents(MATERIALS[7], 3, 0.6),
    _plant: PLANTS[1],
  });

  // 8. Blocked + Pick Complete (non-material cause — investigate)
  push({
    plannedStart: hAgo(3), plannedFinish: hAhead(2),
    actualStart: null,
    nonMaterialBlock: "Equipment QC hold — L-401 weigh cell out of spec",
    components: pickCompleteComponents(MATERIALS[8], 3),
    _plant: PLANTS[2],
  });

  // 9. Technically complete
  push({
    plannedStart: hAgo(20), plannedFinish: hAgo(10),
    actualStart: hAgo(19), actualFinish: hAgo(11), progress: 1.0,
    techComplete: true,
    components: stagedComponents(MATERIALS[4], 3),
    _plant: PLANTS[1],
  });

  // 10. Not Started + Required-Not-Created (cold problem)
  push({
    plannedStart: hAhead(2), plannedFinish: hAhead(8),
    actualStart: null,
    components: notCreatedComponents(MATERIALS[9], 4),
    _plant: PLANTS[3],
  });

  // 11. Not required staging (single-component dry blend, no picks needed)
  push({
    plannedStart: hAhead(3), plannedFinish: hAhead(9),
    actualStart: null,
    components: notRequiredComponents(MATERIALS[1]),
    _plant: PLANTS[3],
  });

  // 12. Running, full materials issued, on track
  push({
    plannedStart: hAgo(3), plannedFinish: hAhead(1),
    actualStart: hAgo(2.7), progress: 0.71,
    components: stagedComponents(MATERIALS[0], 3, 0.85),
    _plant: PLANTS[2],
  });

  // 13. Late start big — 6h overdue, no staging
  push({
    plannedStart: hAgo(6), plannedFinish: hAhead(0.5),
    actualStart: null,
    components: notCreatedComponents(MATERIALS[5], 4),
    _plant: PLANTS[0],
  });

  // 14. Late finish + tech complete pending
  push({
    plannedStart: hAgo(14), plannedFinish: hAgo(4),
    actualStart: hAgo(13.5), actualFinish: hAgo(0.4), progress: 1.0,
    components: stagedComponents(MATERIALS[2], 3),
    _plant: PLANTS[3],
  });

  // 15. Pick complete, awaiting stage-to-line
  push({
    plannedStart: hAhead(1), plannedFinish: hAhead(7),
    actualStart: null,
    components: pickCompleteComponents(MATERIALS[6], 3),
    _plant: PLANTS[1],
  });

  // Now fill out the rest with a healthy mix
  while (orders.length < 84) {
    const r = Math.random();
    const matIdx = Math.floor(Math.random() * MATERIALS.length);
    const plant = PLANTS[Math.floor(Math.random() * PLANTS.length)];
    if (r < 0.32) {
      // Running on track
      const ps = 0.5 + Math.random() * 4;
      const dur = 4 + Math.random() * 8;
      push({
        plannedStart: hAgo(ps), plannedFinish: hAhead(dur - ps),
        actualStart: hAgo(ps - 0.1 - Math.random() * 0.4),
        progress: Math.min(0.98, (ps / dur) + (Math.random() - 0.5) * 0.1),
        components: stagedComponents(MATERIALS[matIdx], 3 + Math.floor(Math.random()*2), 0.6 + Math.random()*0.35),
        _plant: plant,
      });
    } else if (r < 0.48) {
      // Not started, future, staging in flight
      const ps = 0.5 + Math.random() * 12;
      const dur = 3 + Math.random() * 8;
      push({
        plannedStart: hAhead(ps), plannedFinish: hAhead(ps + dur),
        actualStart: null,
        components: Math.random() < 0.55 ? stagedComponents(MATERIALS[matIdx], 3) :
                    Math.random() < 0.5 ? trCreatedComponents(MATERIALS[matIdx], 3, 0.4) :
                    pickCompleteComponents(MATERIALS[matIdx], 3),
        _plant: plant,
      });
    } else if (r < 0.62) {
      // Completed
      const ps = 6 + Math.random() * 30;
      const dur = 4 + Math.random() * 8;
      push({
        plannedStart: hAgo(ps), plannedFinish: hAgo(Math.max(0.2, ps - dur)),
        actualStart: hAgo(ps - 0.2),
        actualFinish: hAgo(Math.max(0.1, ps - dur - 0.2)),
        progress: 1.0,
        techComplete: Math.random() < 0.4,
        components: stagedComponents(MATERIALS[matIdx], 3),
        _plant: plant,
      });
    } else if (r < 0.74) {
      // Late start — planned passed, not started
      const ps = 0.4 + Math.random() * 4;
      const dur = 4 + Math.random() * 6;
      push({
        plannedStart: hAgo(ps), plannedFinish: hAhead(dur - ps),
        actualStart: null,
        components: Math.random() < 0.5 ? stagedComponents(MATERIALS[matIdx], 3) :
                    trCreatedComponents(MATERIALS[matIdx], 3, 0.6),
        _plant: plant,
      });
    } else if (r < 0.83) {
      // Late finish — running past planned finish
      const ps = 5 + Math.random() * 5;
      const dur = 3 + Math.random() * 4;
      push({
        plannedStart: hAgo(ps), plannedFinish: hAgo(Math.max(0.2, ps - dur)),
        actualStart: hAgo(ps - 0.2),
        progress: 0.65 + Math.random() * 0.3,
        components: stagedComponents(MATERIALS[matIdx], 3),
        _plant: plant,
      });
    } else if (r < 0.92) {
      // Running but staging incomplete (mat readiness risk)
      const ps = 0.3 + Math.random() * 2;
      const dur = 4 + Math.random() * 6;
      push({
        plannedStart: hAgo(ps), plannedFinish: hAhead(dur - ps),
        actualStart: hAgo(ps - 0.1),
        progress: 0.05 + Math.random() * 0.2,
        components: trCreatedComponents(MATERIALS[matIdx], 3, 0.3 + Math.random() * 0.4),
        _plant: plant,
      });
    } else {
      // Blocked — equipment / QC
      const ps = 1 + Math.random() * 5;
      const dur = 3 + Math.random() * 5;
      push({
        plannedStart: hAgo(ps), plannedFinish: hAhead(dur - ps),
        actualStart: null,
        nonMaterialBlock: pickBlock(),
        components: pickCompleteComponents(MATERIALS[matIdx], 3),
        _plant: plant,
      });
    }
  }

  return orders;
}

// ---------- component fabricators (different staging states) ----------

function defaultComponents(parentMat) {
  return stagedComponents(parentMat, 3);
}

function stagedComponents(parentMat, count, issuedRatio = 0.95) {
  const comps = [];
  for (let i = 0; i < count; i++) {
    const m = MATERIALS[(MATERIALS.indexOf(parentMat) + i + 1) % MATERIALS.length];
    const required = Math.round((20 + Math.random() * 200) / 5) * 5;
    comps.push({
      id: m.id, name: m.name, family: m.family,
      required, uom: "kg",
      issued: Math.round(required * issuedRatio),
      stagedToLine: true,
      pickComplete: true,
      trCreated: true,
      stagingRequired: true,
    });
  }
  return comps;
}

function pickCompleteComponents(parentMat, count) {
  const comps = stagedComponents(parentMat, count, 0.0);
  return comps.map((c) => ({ ...c, issued: 0, stagedToLine: false, pickComplete: true, trCreated: true }));
}

function trCreatedComponents(parentMat, count, pickRatio = 0.5) {
  const comps = stagedComponents(parentMat, count, 0.0);
  return comps.map((c, i) => ({
    ...c,
    issued: 0,
    stagedToLine: false,
    pickComplete: i / count < pickRatio,
    trCreated: true,
  }));
}

function notCreatedComponents(parentMat, count) {
  const comps = stagedComponents(parentMat, count, 0.0);
  return comps.map((c) => ({
    ...c,
    issued: 0,
    stagedToLine: false,
    pickComplete: false,
    trCreated: false,
  }));
}

function notRequiredComponents(parentMat) {
  return [{
    id: parentMat.id, name: parentMat.name, family: parentMat.family,
    required: 0, uom: "kg", issued: 0, stagedToLine: false,
    pickComplete: false, trCreated: false, stagingRequired: false,
  }];
}

function pickBlock() {
  const blocks = [
    "Equipment QC hold — weigh-cell out of spec",
    "QA hold — micro release pending",
    "Equipment hold — CIP cycle overrun",
    "Cleanroom downgrade — awaiting environmental release",
    "Allergen changeover not signed off",
  ];
  return blocks[Math.floor(Math.random() * blocks.length)];
}

function randomOperator() {
  const names = ["A. Kowalski", "M. Patel", "R. Hernandez", "S. O'Brien", "L. Nguyen", "J. Müller", "D. Andersen", "K. Tanaka"];
  return names[Math.floor(Math.random() * names.length)];
}

// =====================================================================
// CANONICAL STATUS DERIVATION
// =====================================================================
// Single source of truth — these pure functions are how PEX-E-35 turns
// raw order facts into business meaning. No SAP codes leak through.
// =====================================================================

const EXEC = {
  NOT_STARTED:     { id: "NOT_STARTED",     label: "Not Started",     tone: "neutral" },
  RUNNING:         { id: "RUNNING",         label: "Running",         tone: "info" },
  COMPLETED:       { id: "COMPLETED",       label: "Completed",       tone: "success" },
  TECH_COMPLETE:   { id: "TECH_COMPLETE",   label: "Tech. Complete",  tone: "muted" },
  BLOCKED:         { id: "BLOCKED",         label: "Blocked",         tone: "danger" },
};

const STAGING = {
  NOT_REQUIRED:        { id: "NOT_REQUIRED",        label: "Not Required",       tone: "muted" },
  REQUIRED_NOT_CREATED:{ id: "REQUIRED_NOT_CREATED",label: "Required · No TR",   tone: "danger" },
  TR_CREATED:          { id: "TR_CREATED",          label: "TR Created",         tone: "warn" },
  PICK_COMPLETE:       { id: "PICK_COMPLETE",       label: "Pick Complete",      tone: "info" },
  STAGED_TO_LINE:      { id: "STAGED_TO_LINE",      label: "Staged to Line",     tone: "success" },
};

function deriveStaging(o) {
  const required = (o.components || []).filter((c) => c.stagingRequired);
  if (required.length === 0) return STAGING.NOT_REQUIRED;
  if (required.every((c) => c.stagedToLine)) return STAGING.STAGED_TO_LINE;
  if (required.every((c) => c.pickComplete)) return STAGING.PICK_COMPLETE;
  if (required.some((c) => c.trCreated))     return STAGING.TR_CREATED;
  return STAGING.REQUIRED_NOT_CREATED;
}

function deriveExecution(o, stagingId) {
  if (o.techComplete) return EXEC.TECH_COMPLETE;
  if (o.actualFinish) return EXEC.COMPLETED;
  // Blocked detection — non-material block, OR running with no staging requested
  if (o.nonMaterialBlock) return EXEC.BLOCKED;
  if (!o.actualStart) {
    // Pre-start: blocked if past planned start AND staging Required-Not-Created
    if (new Date(o.plannedStart).getTime() < NOW &&
        stagingId === "REQUIRED_NOT_CREATED" &&
        (NOW - new Date(o.plannedStart).getTime()) > 4 * HOUR) {
      return EXEC.BLOCKED;
    }
    return EXEC.NOT_STARTED;
  }
  return EXEC.RUNNING;
}

// Exception flags — derived signals, drive sorting
function deriveExceptions(o, exec, staging) {
  const flags = [];
  const startMs = new Date(o.plannedStart).getTime();
  const finMs = new Date(o.plannedFinish).getTime();

  // Late start
  if (exec.id === "NOT_STARTED" && startMs < NOW) {
    const hrsLate = (NOW - startMs) / HOUR;
    flags.push({ id: "LATE_START", sev: hrsLate > 2 ? 3 : 2, label: `Late start · ${hrsLate.toFixed(1)}h overdue` });
  }
  // Late finish
  if (exec.id === "RUNNING" && finMs < NOW) {
    const hrsLate = (NOW - finMs) / HOUR;
    flags.push({ id: "LATE_FINISH", sev: 3, label: `Late finish · ${hrsLate.toFixed(1)}h past plan` });
  }
  // Running + Required-Not-Created (active risk)
  if (exec.id === "RUNNING" && staging.id === "REQUIRED_NOT_CREATED") {
    flags.push({ id: "RUN_NO_STAGING", sev: 4, label: "Running without staging" });
  }
  // Running + TR Created (material readiness risk)
  if (exec.id === "RUNNING" && staging.id === "TR_CREATED") {
    flags.push({ id: "RUN_PARTIAL", sev: 2, label: "Running on partial staging" });
  }
  // Not started + Staged (ready but idle)
  if (exec.id === "NOT_STARTED" && staging.id === "STAGED_TO_LINE" && startMs < NOW + 0.5 * HOUR) {
    flags.push({ id: "READY_IDLE", sev: 1, label: "Ready but idle" });
  }
  // Completed + TR still open
  if (exec.id === "COMPLETED" && (staging.id === "TR_CREATED" || staging.id === "PICK_COMPLETE")) {
    flags.push({ id: "LOG_LAG", sev: 1, label: "Logistics lag — TR still open" });
  }
  // Blocked + Pick Complete (non-material cause)
  if (exec.id === "BLOCKED" && staging.id === "PICK_COMPLETE") {
    flags.push({ id: "NON_MAT_BLOCK", sev: 3, label: "Investigate · materials are ready" });
  }
  // Material readiness < 90% on running
  if (exec.id === "RUNNING") {
    const req = (o.components || []).filter((c) => c.stagingRequired);
    if (req.length) {
      const ratio = req.reduce((s,c) => s + (c.issued / Math.max(1,c.required)), 0) / req.length;
      if (ratio < 0.9 && !flags.find((f) => f.id === "RUN_NO_STAGING") && !flags.find((f) => f.id === "RUN_PARTIAL")) {
        flags.push({ id: "MAT_RISK", sev: 2, label: `Material readiness ${Math.round(ratio*100)}%` });
      }
    }
  }

  return flags;
}

// Compute everything for a row
function deriveAll(o) {
  const staging = deriveStaging(o);
  const exec = deriveExecution(o, staging.id);
  const flags = deriveExceptions(o, exec, staging);
  const riskScore = flags.reduce((s, f) => s + f.sev, 0);
  // Material readiness ratio
  const req = (o.components || []).filter((c) => c.stagingRequired);
  const matReadiness = req.length === 0 ? 1 : req.reduce((s,c) => s + Math.min(1, c.issued / Math.max(1,c.required)), 0) / req.length;
  return { ...o, exec, staging, flags, riskScore, matReadiness };
}

// ---------- exports to window ----------
const PEX_DATASET = makeDataset().map(deriveAll);

Object.assign(window, {
  PEX_DATASET, PEX_NOW: NOW, PEX_HOUR: HOUR,
  PEX_PLANTS: PLANTS, PEX_LINES_BY_PLANT: LINES_BY_PLANT,
  pexFmtClock: fmtClock, pexFmtRel: fmtRel,
  PEX_EXEC: EXEC, PEX_STAGING: STAGING,
  pexDeriveAll: deriveAll,
});
