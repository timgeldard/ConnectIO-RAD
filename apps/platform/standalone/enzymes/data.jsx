/* Mock domain data for PEX·E·90.
   Enzyme blending: declared activity, side activities, moisture, particle size,
   diluent (lactose / sodium chloride / starch), batch lots with characteristics. */

const ENZYME_ORDERS = [
  {
    id: "PO-4471290",
    sku: "ALPHALASE-NP-2.5L",
    product: "Alphalase NP — Neutral Protease",
    declared: "2,500 NPU/g",
    qty: "1,800 kg",
    site: "Carrigaline · IE",
    line: "Blend Line 3",
    due: "2026-05-09",
    status: "ready",
    priority: "high",
  },
  {
    id: "PO-4471304",
    sku: "GLUCAMYL-HT-3.0",
    product: "Glucamyl HT — Glucoamylase",
    declared: "3,000 AGU/g",
    qty: "950 kg",
    site: "Rochester · US",
    line: "Blend Line 1",
    due: "2026-05-10",
    status: "ready",
    priority: "med",
  },
  {
    id: "PO-4471318",
    sku: "XYLAZYME-FB-1.5K",
    product: "Xylazyme FB — Endo-xylanase",
    declared: "1,500 FXU/g",
    qty: "1,200 kg",
    site: "Carrigaline · IE",
    line: "Blend Line 2",
    due: "2026-05-11",
    status: "tight",
    priority: "med",
  },
  {
    id: "PO-4471322",
    sku: "PROTAZYME-AC-PH4",
    product: "Protazyme AC — Acid Protease",
    declared: "850 HUT/g",
    qty: "600 kg",
    site: "Beloit · US",
    line: "Blend Line 4",
    due: "2026-05-12",
    status: "ready",
    priority: "low",
  },
  {
    id: "PO-4471341",
    sku: "LIPOZYME-CN-12",
    product: "Lipozyme CN — Lipase",
    declared: "12,000 LU/g",
    qty: "420 kg",
    site: "Carrigaline · IE",
    line: "Blend Line 3",
    due: "2026-05-13",
    status: "infeasible",
    priority: "high",
  },
  {
    id: "PO-4471358",
    sku: "PHYTASE-XR-5K",
    product: "Phytase XR — 6-phytase",
    declared: "5,000 FTU/g",
    qty: "2,400 kg",
    site: "Rochester · US",
    line: "Blend Line 1",
    due: "2026-05-14",
    status: "ready",
    priority: "med",
  },
];

// The active order — Alphalase NP — used in the workbench
const ACTIVE_ORDER = ENZYME_ORDERS[0];

// Available batch lots in the warehouse, with lab-measured characteristics
const BATCH_LOTS = [
  {
    id: "B-24-1187",
    age: 12,
    qty: 380,
    activity: 2842,        // NPU/g (declared activity for this enzyme family)
    sideAct: 18,           // amylase side-activity, % of spec ceiling
    moisture: 4.8,         // % w/w
    particle: 142,         // µm D50
    proposed: 380,
    suggested: 380,
    flag: "preferred",
  },
  {
    id: "B-24-1192",
    age: 18,
    qty: 520,
    activity: 2710,
    sideAct: 22,
    moisture: 5.1,
    particle: 138,
    proposed: 0,
    suggested: 460,
    flag: null,
  },
  {
    id: "B-24-1203",
    age: 22,
    qty: 410,
    activity: 2965,        // hot batch — high activity
    sideAct: 26,
    moisture: 4.4,
    particle: 151,
    proposed: 410,
    suggested: 240,
    flag: "high-act",
  },
  {
    id: "B-24-1218",
    age: 31,
    qty: 290,
    activity: 2480,        // weak
    sideAct: 14,
    moisture: 5.6,
    particle: 128,
    proposed: 290,
    suggested: 0,
    flag: "weak",
  },
  {
    id: "B-24-1231",
    age: 8,
    qty: 600,
    activity: 2812,
    sideAct: 19,
    moisture: 4.9,
    particle: 144,
    proposed: 0,
    suggested: 320,
    flag: "fresh",
  },
];

const DILUENTS = [
  { id: "DIL-LAC", name: "Lactose monohydrate", role: "primary diluent", current: 220, suggested: 358, available: 4200, color: "#F1F1E5", textColor: "#143700" },
  { id: "DIL-NACL", name: "Sodium chloride", role: "carrier salt", current: 0, suggested: 22, available: 1800, color: "#CCDDE9", textColor: "#005776" },
];

// Constraints — min, target, max for each measured property
const CONSTRAINTS = [
  {
    id: "activity",
    name: "Declared activity",
    unit: "NPU/g",
    min: 2450,
    target: 2500,
    max: 2625,            // +5% ceiling
    axisMin: 2300,
    axisMax: 2750,
    current: 2738,
    optimised: 2512,
    binding: false,
    critical: true,
    desc: "Must hit declared label claim with ≤5% over-declaration to protect margin.",
  },
  {
    id: "side-amyl",
    name: "Side activity — α-amylase",
    unit: "% of ceiling",
    min: 0,
    target: 15,
    max: 25,
    axisMin: 0,
    axisMax: 35,
    current: 22,
    optimised: 19.4,
    binding: true,
    critical: true,
    desc: "Customer spec — ceiling at 25% of α-amylase side activity.",
  },
  {
    id: "moisture",
    name: "Moisture",
    unit: "% w/w",
    min: 3.0,
    target: 4.5,
    max: 5.5,
    axisMin: 2.5,
    axisMax: 6.0,
    current: 5.0,
    optimised: 4.7,
    binding: false,
    critical: false,
    desc: "Stability driver — caking risk above 5.5%.",
  },
  {
    id: "particle",
    name: "Particle size D50",
    unit: "µm",
    min: 120,
    target: 145,
    max: 170,
    axisMin: 100,
    axisMax: 190,
    current: 144,
    optimised: 143,
    binding: false,
    critical: false,
    desc: "Dustiness + dissolution rate.",
  },
  {
    id: "lot-age",
    name: "Weighted lot age",
    unit: "days",
    min: 0,
    target: 14,
    max: 28,
    axisMin: 0,
    axisMax: 40,
    current: 19,
    optimised: 16,
    binding: false,
    critical: false,
    desc: "FEFO — favours younger lots; soft target.",
  },
];

// Top-line KPIs for current vs optimised
const KPI = {
  current: {
    yield: 96.3,
    overDose: 9.5,        // % over declared activity
    diluentUse: 220,      // kg
    cost: 18420,          // €
    feasible: true,
    bottleneck: "Side α-amylase 22% — within spec but trending toward ceiling",
  },
  optimised: {
    yield: 99.1,
    overDose: 0.5,
    diluentUse: 380,
    cost: 17985,
    feasible: true,
    bottleneck: "Side α-amylase",
  },
};

// Audit reasons (for accept dialog)
const REASON_CODES = [
  { id: "act-recovery",  label: "Activity over-declaration recovery" },
  { id: "fefo",          label: "FEFO — older inventory consumption" },
  { id: "side-act",      label: "Side-activity mitigation" },
  { id: "cost-down",     label: "Cost reduction" },
  { id: "spec-tighten",  label: "Customer spec tightening" },
];

Object.assign(window, {
  ENZYME_ORDERS, ACTIVE_ORDER, BATCH_LOTS, DILUENTS,
  CONSTRAINTS, KPI, REASON_CODES,
});
