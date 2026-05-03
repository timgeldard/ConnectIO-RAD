/* Demo data for the lineside monitor — mixed shift scenario.
   Multiple concurrent process orders per line are supported.
   All statuses follow PEX-E-35 canonical model. No SAP codes. */

const PLANTS = [
  { id: "listowel-04", name: "Listowel · Plant 04", shift: "Shift B · 14:00 – 22:00" },
  { id: "rochester-02", name: "Rochester · Plant 02", shift: "Shift A · 06:00 – 14:00" },
  { id: "naas-01", name: "Naas · Plant 01", shift: "Shift B · 14:00 – 22:00" },
];

// Each line now has runningOrders: [] — supports 1+ concurrent process orders.
const LINES = [
  {
    id: "L-04",
    name: "Line 04 · Dry Blend",
    plantId: "listowel-04",
    runningOrders: [
      {
        id: "PO-2046718",
        product: "Cheese & Onion Seasoning Mix",
        material: "MAT-44218",
        batch: "B-220406",
        pctComplete: 64,
        elapsedMin: 142,
        plannedMin: 220,
        phaseLabel: "Blending — Stage 2",
        phaseStartedMin: 38,
        activityType: "Run",
      },
      {
        id: "PO-2046722",
        product: "Smoky BBQ Topical Seasoning",
        material: "MAT-44307",
        batch: "B-220409",
        pctComplete: 18,
        elapsedMin: 26,
        plannedMin: 180,
        phaseLabel: "Pre-Mix",
        phaseStartedMin: 11,
        activityType: "Setup",
      },
    ],
    nextOrders: [
      { id: "PO-2046719", product: "Sour Cream & Chive Mix",      material: "MAT-44231", plannedStart: "16:40", staging: "staged" },
      { id: "PO-2046720", product: "Salt & Vinegar Topical",      material: "MAT-44402", plannedStart: "18:10", staging: "pick" },
      { id: "PO-2046721", product: "Honey Mustard Dry Blend",     material: "MAT-44415", plannedStart: "19:55", staging: "none" },
    ],
    blocked: [],
    atRisk: [
      { id: "PO-2046718", reason: "Planned finish breached by ~22 min", type: "late", blockedMin: 22, line: "L-04" },
    ],
  },
  {
    id: "L-05",
    name: "Line 05 · Liquid Flavour",
    plantId: "listowel-04",
    runningOrders: [
      {
        id: "PO-2046903",
        product: "Citrus Burst Beverage Compound",
        material: "MAT-51109",
        batch: "B-220411",
        pctComplete: 31,
        elapsedMin: 64,
        plannedMin: 180,
        phaseLabel: "Homogenisation",
        phaseStartedMin: 12,
        activityType: "Run",
      },
    ],
    nextOrders: [
      { id: "PO-2046904", product: "Tropical Iced Tea Compound",  material: "MAT-51122", plannedStart: "17:20", staging: "staged" },
      { id: "PO-2046905", product: "Lemon Lime Sport Concentrate",material: "MAT-51140", plannedStart: "19:00", staging: "pick" },
    ],
    blocked: [
      { id: "PO-2046902", reason: "Awaiting MAT-51188 (citric acid) — TR not picked",
        type: "material", blockedMin: 47, line: "L-05" },
    ],
    atRisk: [],
  },
  {
    id: "L-06",
    name: "Line 06 · Savoury Powder",
    plantId: "listowel-04",
    runningOrders: [],
    nextOrders: [
      { id: "PO-2046551", product: "Roast Chicken Stock Powder",  material: "MAT-22310", plannedStart: "15:30", staging: "none" },
      { id: "PO-2046552", product: "Beef Bouillon Granules",      material: "MAT-22318", plannedStart: "17:45", staging: "pick" },
    ],
    blocked: [
      { id: "PO-2046550", reason: "Staging incomplete — pallet 3 of 4 missing at line",
        type: "staging", blockedMin: 31, line: "L-06" },
    ],
    atRisk: [],
  },
  {
    id: "L-07",
    name: "Line 07 · Encapsulation",
    plantId: "listowel-04",
    runningOrders: [
      {
        id: "PO-2047012",
        product: "Vitamin D3 Microencapsulate",
        material: "MAT-77041",
        batch: "B-220418",
        pctComplete: 88,
        elapsedMin: 196,
        plannedMin: 210,
        phaseLabel: "Drying — Final",
        phaseStartedMin: 81,
        activityType: "Run",
      },
    ],
    nextOrders: [
      { id: "PO-2047013", product: "Omega-3 Spray-Dried Powder",  material: "MAT-77052", plannedStart: "16:15", staging: "staged" },
    ],
    blocked: [],
    atRisk: [],
  },
];

const STAGING_24H = {
  staged: 9, pickComplete: 4, trCreated: 6, noTR: 3, notRequired: 5,
};

const PLAN_VS_ACTUAL = {
  plannedUnits: 14, actualUnits: 9, shiftPctElapsed: 62, variancePct: -8,
};

const SEED_TIME = "16:42";

window.MonitorData = { PLANTS, LINES, STAGING_24H, PLAN_VS_ACTUAL, SEED_TIME };
