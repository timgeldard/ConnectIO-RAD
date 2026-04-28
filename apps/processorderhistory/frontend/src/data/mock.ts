// @ts-nocheck
// Mock data aligned to Kerry Databricks dashboard:
// connected_plant_uat.csm_process_order_history.* views
// Real schema: PROCESS_ORDER_ID (10-digit numeric), MATERIAL_ID, BATCH_ID, etc.
//
// This module mirrors the design-prototype data.js verbatim. The prototype
// attached fixtures to `window.KERRY_DATA`; here we collect them into a single
// exported `KERRY_DATA` object and re-export named accessors so React
// components can `import { KERRY_DATA, buildDetail } from "~/data/mock"`.
//
// TODO(processorderhistory): swap in real DAL queries against
// `connected_plant_uat.gold` once the SQL views are stable. See docs/architecture.md.

// ----- Reference catalogs -----
// Real-style: numeric material IDs + ALL CAPS technical descriptions (German/English mix)
const PRODUCTS = [
  { matId: '202105',  name: 'TASTESENSE SWEET REFORMULATION K2210',          category: 'TASTE',              cleanName: 'Tastesense™ Sweet Reformulation' },
  { matId: '218403',  name: 'PRODIEM PLANT PROTEIN BLEND X4501',              category: 'PROACTIVE HEALTH',   cleanName: 'ProDiem™ Plant Protein Blend' },
  { matId: '198772',  name: 'NATRIUMREDUKTIONSSYSTEM SR-9 R1108',              category: 'TASTE',              cleanName: 'Sodium Reduction System SR-9' },
  { matId: '231009',  name: 'WELLMUNE BETA GLUCAN N3302',                       category: 'PROACTIVE HEALTH',   cleanName: 'Wellmune® Beta Glucan' },
  { matId: '167551',  name: 'MILCHPROTEINISOLAT 90% P0921',                     category: 'FOUNDATIONAL',        cleanName: 'Dairy Protein Isolate 90%' },
  { matId: '241886',  name: 'CITRUS COLD-PRESSED FLAVOR C7714',                 category: 'TASTE',              cleanName: 'Citrus Cold-Pressed Flavor' },
  { matId: '209114',  name: 'EMULGATORSYSTEM ES-204 S2204',                     category: 'FOUNDATIONAL',        cleanName: 'Emulsifier System ES-204' },
  { matId: '256822',  name: 'GANEDENBC30 PROBIOTIC G6608',                      category: 'PROACTIVE HEALTH',   cleanName: 'GanedenBC30® Probiotic' },
  { matId: '184432',  name: 'PLANT-BASED COATING SOLUTION V1199',                category: 'FOODSERVICE',        cleanName: 'Plant-Based Coating Solution' },
  { matId: '273901',  name: 'MEAT MARINADE BBQ BOLD B4407',                      category: 'FOODSERVICE',        cleanName: 'Meat Marinade BBQ Bold' },
  { matId: '215667',  name: 'SAVOURY UMAMI CONCENTRATE U3308',                   category: 'TASTE',              cleanName: 'Savoury Umami Concentrate' },
  { matId: '178220',  name: 'CULTURED CREAM POWDER D9912',                      category: 'FOUNDATIONAL',        cleanName: 'Cultured Cream Powder' },
];

const PLANTS = [
  { code: 'RUN1', name: 'Runcorn, UK' },
  { code: 'BVL2', name: 'Beloit, US' },
  { code: 'LND3', name: 'Landgraaf, NL' },
  { code: 'TRS4', name: 'Três Corações, BR' },
  { code: 'NJG5', name: 'Nanjing, CN' },
  { code: 'IRP6', name: 'Irapuato, MX' },
];

const OPERATORS = ['M. Brennan', 'A. Yusuf', 'C. Whitaker', 'L. Park', 'R. Costa', 'I. Petrov', 'F. Mendez', 'K. Okafor', 'D. Vance', 'H. Nakamura'];

// Real Databricks status values
const STATUSES_LIST = [
  { key: 'running',    label: 'REL',   labelLong: 'Released',  count: 47 },
  { key: 'completed',  label: 'TECO',  labelLong: 'Completed', count: 1284 },
  { key: 'released',   label: 'CRTD',  labelLong: 'Created',   count: 19 },
  { key: 'onhold',     label: 'PCNF',  labelLong: 'On hold',   count: 6 },
  { key: 'failed',     label: 'CNF',   labelLong: 'Failed',    count: 3 },
  { key: 'cancelled',  label: 'DLT',   labelLong: 'Cancelled', count: 11 },
];

// Allergens used by some materials (ALLERGENS field is comma-separated CONCAT_WS in the SQL)
const ALLERGEN_SETS = [
  'MILK, SOY',
  'MILK, WHEAT, SOY',
  'NONE',
  'TREE NUTS, SOY',
  'EGG, MILK',
  'GLUTEN, MILK, SOY',
  'NONE',
  'MILK',
];

// Deterministic pseudo-random
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pad(n, w) { return n.toString().padStart(w, '0'); }

function generateOrders(count = 48) {
  const r = mulberry32(11);
  const orders = [];
  // anchor "now" so the data is stable
  const NOW = new Date('2026-04-26T14:30:00Z').getTime();
  const HOUR = 3600 * 1000;
  for (let i = 0; i < count; i++) {
    const product = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
    const plant = PLANTS[Math.floor(r() * PLANTS.length)];
    const operator = OPERATORS[Math.floor(r() * OPERATORS.length)];

    // Status weighted: many completed, some running, few else
    const sRoll = r();
    let status;
    if (i < 4) status = 'running';
    else if (sRoll < 0.78) status = 'completed';
    else if (sRoll < 0.85) status = 'released';
    else if (sRoll < 0.92) status = 'onhold';
    else if (sRoll < 0.97) status = 'cancelled';
    else status = 'failed';

    // Start time
    const ageHours = i < 4 ? r() * 8 : 6 + r() * 24 * 60;
    const start = NOW - ageHours * HOUR;
    const durationH = 2 + r() * 14;
    const end = status === 'running' ? null : start + durationH * HOUR;

    const targetQty = [500, 1000, 1500, 2000, 2500, 3000, 5000][Math.floor(r() * 7)];
    let actualQty;
    if (status === 'running') actualQty = Math.round(targetQty * (0.2 + r() * 0.5));
    else if (status === 'cancelled') actualQty = 0;
    else if (status === 'failed') actualQty = Math.round(targetQty * (0.3 + r() * 0.4));
    else actualQty = Math.round(targetQty * (0.92 + r() * 0.08));

    let yieldPct;
    if (status === 'running' || status === 'cancelled') yieldPct = null;
    else yieldPct = Math.round((actualQty / targetQty) * 1000) / 10;

    // 10-digit numeric PO ID, realistic Kerry-style range starting 70069...
    const poId = (7006960000 + i * 137 + Math.floor(r() * 199)).toString();
    // 10-digit batch ID
    const batchId = (8000000000 + Math.floor(r() * 99999999)).toString();
    const supplierBatchId = pad(Math.floor(r() * 999999), 6) + '-' + plant.code;

    // Manufacture date within ~start; expiry +18mo
    const manufactureDate = start;
    const expiryDate = manufactureDate + 540 * 24 * HOUR;

    const allergens = ALLERGEN_SETS[Math.floor(r() * ALLERGEN_SETS.length)];

    orders.push({
      // Real Databricks schema fields
      processOrderId: poId,
      materialId: product.matId,
      materialDescription: product.name,
      plantId: plant.code,
      batchId,
      supplierBatchId,
      manufactureDate,
      expiryDate,
      allergens,
      orderStatus: STATUSES_LIST.find(s => s.key === status).label,

      // Display / convenience
      id: poId,                          // legacy alias
      lot: 'BATCH-' + batchId.slice(-6),  // legacy alias
      product: { sku: product.matId, name: product.cleanName, category: product.category, fullName: product.name },
      plant, operator,
      status,
      targetQty, actualQty,
      yieldPct,
      start, end,
      durationH: status === 'running' ? null : Math.round(durationH * 10) / 10,
      shift: ['A', 'B', 'C'][Math.floor(r() * 3)],
      line: ['MIX-04','MIX-07','SPD-02','SPD-05','EXT-03','PCK-12','PCK-18','BLD-01','MIX-04','SPD-02'][Math.floor(r() * 10)],
    });
  }
  // Sort: running first, then by start desc
  orders.sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return b.start - a.start;
  });
  return orders;
}

const ORDERS_LIST = generateOrders(48);

// ----- Detail data -----
// Builds all sub-datasets for the Order Detail screen, modeled on:
//  vw_gold_process_order_phase, vw_gold_confirmation, vw_gold_adp_movement,
//  vw_gold_inspection_result, vw_gold_inspection_usage_decision,
//  vw_gold_downtime_and_issues, vw_gold_equipment_history,
//  vw_gold_logs_notes_and_comments
function buildDetail(order) {
  const HOUR = 3600 * 1000;
  const start = order.start;
  // seed off PO id digits for variety
  const seed = parseInt(order.processOrderId.slice(-5), 10) || 1;
  const r = mulberry32(seed);

  // Phases — mirrors vw_gold_process_order_phase
  const phaseDefs = [
    { id: '0010', desc: 'CHARGE WEIGHING',           text: 'Vorwiegen Rohstoffe',        setupH: 0.5, machH: 1.2, cleanH: 0.3 },
    { id: '0020', desc: 'PRE-MIX BLENDING',           text: 'Vormischung',                setupH: 0.4, machH: 2.4, cleanH: 0.4 },
    { id: '0030', desc: 'MAIN BATCH PROCESSING',     text: 'Hauptverarbeitung',          setupH: 0.6, machH: 4.1, cleanH: 0.6 },
    { id: '0040', desc: 'SPRAY DRYING',              text: 'Sprühtrocknung',             setupH: 0.8, machH: 3.6, cleanH: 0.7 },
    { id: '0050', desc: 'SIEVING & PACKAGING',       text: 'Sieben und Verpackung',      setupH: 0.3, machH: 1.8, cleanH: 0.5 },
  ];
  const phases = phaseDefs.map((p, i) => ({
    PHASE_ID: p.id,
    PHASE_DESCRIPTION: p.desc,
    PHASE_TEXT: p.text,
    START_USER: order.operator.replace(/\./g, '').toUpperCase().replace(' ', ''),
    END_USER: OPERATORS[(seed + i) % OPERATORS.length].replace(/\./g, '').toUpperCase().replace(' ', ''),
    OPERATION_QUANTITY: i === 4 ? order.actualQty : order.targetQty,
    OPERATION_QUANTITY_UOM: 'KG',
    SORT_NUMBER: i + 1,
    setupH: p.setupH * (0.85 + r() * 0.3),
    machH: p.machH * (0.85 + r() * 0.3),
    cleanH: p.cleanH * (0.85 + r() * 0.3),
    startTs: start + (i === 0 ? 0 : phaseDefs.slice(0, i).reduce((a, x) => a + (x.setupH + x.machH + x.cleanH) * HOUR, 0)),
  }));
  phases.forEach((p, i) => {
    p.endTs = p.startTs + (p.setupH + p.machH + p.cleanH) * HOUR;
  });

  const totalSetupS = phases.reduce((a, p) => a + p.setupH * 3600, 0);
  const totalMachS  = phases.reduce((a, p) => a + p.machH * 3600, 0);
  const totalCleanS = phases.reduce((a, p) => a + p.cleanH * 3600, 0);

  // Confirmations — vw_gold_confirmation
  const confirmations = phases.map((p, i) => ({
    CONFIRMATION_ID: '0001000' + (i + 1),
    PHASE_ID: p.PHASE_ID,
    CONFIRMED_QUANTITY: p.OPERATION_QUANTITY,
    CONFIRMED_QUANTITY_UOM: 'KG',
    START_TIMESTAMP: p.startTs,
    END_TIMESTAMP: p.endTs,
    SET_UP_DURATION_S: Math.round(p.setupH * 3600),
    MACHINE_DURATION_S: Math.round(p.machH * 3600),
    CLEANING_DURATION_S: Math.round(p.cleanH * 3600),
    GROSS_DURATION_S: Math.round((p.setupH + p.machH + p.cleanH) * 3600),
  }));

  // Movements — vw_gold_adp_movement (ISSUE 261 + RECEIPT 101)
  // Realistic component materials with numeric IDs
  const components = [
    { matId: '300451', name: 'WHEY PROTEIN ISOLATE 90%',           planned: 850, used: 851, unit: 'KG' },
    { matId: '300872', name: 'MIKROKRISTALLINE CELLULOSE PH-101',   planned: 220, used: 218, unit: 'KG' },
    { matId: '301114', name: 'NATÜRLICHES CITRUSAROMA 4X',          planned: 32,  used: 33.4, unit: 'KG' },
    { matId: '301298', name: 'NATRIUMCITRAT USP',                   planned: 18,  used: 18,   unit: 'KG' },
    { matId: '301466', name: 'LECITHIN SONNENBLUME ENTÖLT',         planned: 12,  used: 12.6, unit: 'KG' },
    { matId: '301552', name: 'STEVIA REB-M 95%',                    planned: 4.5, used: 4.4,  unit: 'KG' },
  ];
  const SUPPLIERS = ['Glanbia', 'DuPont Nutrition', 'Symrise', 'ADM', 'Bunge', 'Cargill'];

  const movements = [];
  // ISSUE rows (movement type 261) — one per component
  components.forEach((c, i) => {
    movements.push({
      DATE_TIME_OF_ENTRY: start + (i * 12 + 5) * 60 * 1000,
      MOVEMENT_TYPE: '261',
      MATERIAL_ID: c.matId,
      MATERIAL_NAME: c.name,
      BATCH_ID: 'L-' + (240000 + i * 73 + seed % 100),
      STORAGE_ID: '0001',
      QUANTITY: c.used,
      UOM: c.unit,
      DESTINATION_ST: 'PROD',
      SOURCE_VESSEL_NAME: 'WAREHOUSE-A',
      DESTINATION_VESSEL_NAME: 'V-' + (200 + (seed + i) % 30),
      USER_NAME: order.operator.replace(/\./g, '').toUpperCase().replace(' ', ''),
      MATERIAL_DOCUMENT: '49' + pad(10000 + i * 17, 8),
      ITEM_TYPE: 'ROH',
      APP_FEATURE: 'CHARGE_WEIGHING',
      PHASE_ID: '0010',
      PLANT_ID: order.plantId,
      supplier: SUPPLIERS[i % SUPPLIERS.length],
    });
  });
  // RECEIPT row (movement type 101) — finished goods
  if (order.status !== 'running' && order.status !== 'cancelled') {
    movements.push({
      DATE_TIME_OF_ENTRY: order.end,
      MOVEMENT_TYPE: '101',
      MATERIAL_ID: order.materialId,
      MATERIAL_NAME: order.materialDescription,
      BATCH_ID: order.batchId,
      STORAGE_ID: '0002',
      QUANTITY: order.actualQty,
      UOM: 'KG',
      DESTINATION_ST: 'FG-WH',
      SOURCE_VESSEL_NAME: 'V-' + (200 + seed % 30),
      DESTINATION_VESSEL_NAME: 'PALLET-' + (1000 + seed % 999),
      USER_NAME: order.operator.replace(/\./g, '').toUpperCase().replace(' ', ''),
      MATERIAL_DOCUMENT: '49' + pad(99000 + seed % 999, 8),
      ITEM_TYPE: 'FERT',
      APP_FEATURE: 'BATCH_RECEIPT',
      PHASE_ID: '0050',
      PLANT_ID: order.plantId,
      supplier: '—',
    });
  }

  // Movement Summary — vw_gold_adp_movement aggregation
  const qtyIssuedKg = components.reduce((a, c) => a + c.used, 0);
  const qtyReceivedKg = order.status !== 'running' && order.status !== 'cancelled' ? order.actualQty : null;

  // Inspection Results — vw_gold_inspection_result
  const inspectionLotId = '01000' + pad(seed % 99999, 5);
  const inspections = [
    { CHARACTERISTIC_ID: 'MIC-001', CHARACTERISTIC_DESCRIPTION: 'YIELD',          SAMPLE_ID: 'S-001', SPECIFICATION: '≥ 95.0 %',     QUANTITATIVE_RESULT: '97.2',  UOM: '%',     JUDGEMENT: 'A', INSPECTOR: 'T. BERG',  END_DATE: order.end || start + 6*HOUR },
    { CHARACTERISTIC_ID: 'MIC-002', CHARACTERISTIC_DESCRIPTION: 'MOISTURE',        SAMPLE_ID: 'S-002', SPECIFICATION: '2.5 - 4.0 %', QUANTITATIVE_RESULT: '3.2',   UOM: '%',     JUDGEMENT: 'A', INSPECTOR: 'T. BERG',  END_DATE: order.end || start + 6*HOUR },
    { CHARACTERISTIC_ID: 'MIC-003', CHARACTERISTIC_DESCRIPTION: 'PH',              SAMPLE_ID: 'S-002', SPECIFICATION: '6.0 - 6.8',   QUANTITATIVE_RESULT: '6.4',   UOM: '',      JUDGEMENT: 'A', INSPECTOR: 'T. BERG',  END_DATE: order.end || start + 6*HOUR },
    { CHARACTERISTIC_ID: 'MIC-004', CHARACTERISTIC_DESCRIPTION: 'BULK DENSITY',    SAMPLE_ID: 'S-003', SPECIFICATION: '0.55 - 0.70', QUANTITATIVE_RESULT: '0.62',  UOM: 'g/mL',  JUDGEMENT: 'A', INSPECTOR: 'T. BERG',  END_DATE: order.end || start + 6*HOUR },
    { CHARACTERISTIC_ID: 'MIC-005', CHARACTERISTIC_DESCRIPTION: 'PARTICLE SIZE D50', SAMPLE_ID: 'S-003', SPECIFICATION: '140 ± 20 µm', QUANTITATIVE_RESULT: '142', UOM: 'µm',    JUDGEMENT: 'A', INSPECTOR: 'T. BERG',  END_DATE: order.end || start + 6*HOUR },
    { CHARACTERISTIC_ID: 'MIC-006', CHARACTERISTIC_DESCRIPTION: 'TOTAL PLATE COUNT', SAMPLE_ID: 'S-004', SPECIFICATION: '< 10 CFU/g',  QUALITATIVE_RESULT: 'PASS', UOM: '',     JUDGEMENT: 'A', INSPECTOR: 'M. KELLER', END_DATE: order.end || start + 6*HOUR },
  ].map(x => ({ ...x, INSPECTION_LOT_ID: inspectionLotId }));

  // Usage Decision — vw_gold_inspection_usage_decision
  const usageDecision = (order.status === 'completed' || order.status === 'released') ? {
    INSPECTION_LOT_ID: inspectionLotId,
    USAGE_DECISION_CODE: 'A1',
    VALUATION_CODE: 'A',
    QUALITY_SCORE: 95 + Math.floor(r() * 5),
    USAGE_DECISION_CREATED_BY: 'TBERG',
    USAGE_DECISION_CREATED_DATE: order.end + 4 * HOUR,
    description: 'ACCEPTED — RELEASE TO STOCK',
  } : order.status === 'failed' ? {
    INSPECTION_LOT_ID: inspectionLotId,
    USAGE_DECISION_CODE: 'R1',
    VALUATION_CODE: 'R',
    QUALITY_SCORE: 42,
    USAGE_DECISION_CREATED_BY: 'TBERG',
    USAGE_DECISION_CREATED_DATE: order.end + 6 * HOUR,
    description: 'REJECTED — RETURN TO VENDOR',
  } : null;

  // Downtime & Issues — vw_gold_downtime_and_issues
  const downtimeBank = [
    { reason: 'EQUIP', sub: 'EQUIP-MECH', issue: 'MECHANICAL', title: 'Sieve mesh blockage on packing line', comments: 'Cleared after 18 min. Operator flagged for inspection.' },
    { reason: 'PROC',  sub: 'PROC-CIP',  issue: 'CLEANING',   title: 'Extended CIP cycle on V-217',          comments: 'Conductivity reading delayed return-to-service.' },
    { reason: 'MAT',   sub: 'MAT-WAIT',  issue: 'MATERIAL',   title: 'Awaiting QA release on incoming WPI',   comments: 'COA arrived from Glanbia at 14:02; staged.' },
    { reason: 'OPER',  sub: 'OPER-CHG',  issue: 'CHANGEOVER', title: 'Shift handover documentation',          comments: 'Standard B→C shift handover. No anomalies.' },
  ];
  const downtimeCount = order.status === 'failed' ? 3 : order.status === 'onhold' ? 2 : (seed % 3);
  const downtime = [];
  for (let i = 0; i < downtimeCount; i++) {
    const d = downtimeBank[(seed + i) % downtimeBank.length];
    const dStart = start + (1 + i * 2) * HOUR;
    const dur = (10 + Math.floor(r() * 50)) * 60; // seconds
    downtime.push({
      START_TIME: dStart,
      DOWNTIME_END_TIME: dStart + dur * 1000,
      DURATION: dur,
      REASON_CODE: d.reason,
      SUB_REASON_CODE: d.sub,
      ISSUE_TYPE: d.issue,
      ISSUE_TITLE: d.title,
      OPERATORS_COMMENTS: d.comments,
      TL_COMMENTS: i === 0 ? 'Reviewed and acknowledged.' : '',
      REPORTED_BY: order.operator.replace(/\./g, '').toUpperCase().replace(' ', ''),
      CLOSED_BY_NAME: 'T. BERG',
      PHASE_ID: phases[i % phases.length].PHASE_ID,
    });
  }

  // Equipment History — vw_gold_equipment_history
  const equipmentBank = [
    { type: 'MIXER',     id: 'MIX-04',  from: 'IDLE',     to: 'CLEANING' },
    { type: 'MIXER',     id: 'MIX-04',  from: 'CLEANING', to: 'READY' },
    { type: 'MIXER',     id: 'MIX-04',  from: 'READY',    to: 'RUNNING' },
    { type: 'DRYER',     id: 'SPD-02',  from: 'IDLE',     to: 'WARMUP' },
    { type: 'DRYER',     id: 'SPD-02',  from: 'WARMUP',   to: 'RUNNING' },
    { type: 'PACKAGER',  id: 'PKG-11',  from: 'IDLE',     to: 'RUNNING' },
    { type: 'MIXER',     id: 'MIX-04',  from: 'RUNNING',  to: 'IDLE' },
    { type: 'DRYER',     id: 'SPD-02',  from: 'RUNNING',  to: 'CLEANING' },
  ];
  const equipment = equipmentBank.slice(0, 6).map((e, i) => ({
    CREATED_AT: start + (0.5 + i * 1.2) * HOUR,
    EQUIPMENT_TYPE: e.type,
    STATUS_FROM: e.from,
    STATUS_TO: e.to,
    CHANGE_AT: start + (0.5 + i * 1.2) * HOUR + 60 * 1000,
    INSTRUMENT_ID: e.id,
    COMMENTS: '',
    USER_NAME: order.operator.replace(/\./g, '').toUpperCase().replace(' ', ''),
    BATCH_ID: order.batchId,
    MATERIAL_ID: order.materialId,
    PHASE_ID: phases[i % phases.length].PHASE_ID,
  }));

  // Comments / Logs — vw_gold_logs_notes_and_comments
  const comments = [
    { CREATED: start + 2.4 * HOUR, SENDER: 'M. BRENNAN', NOTES: 'In-process sample S-002 logged. pH and moisture both within spec.', UPDATED_BY: 'MBRENNAN', PHASE_ID: '0030' },
    { CREATED: start + 4.1 * HOUR, SENDER: 'T. BERG',    NOTES: 'Bulk density slightly trending high — within tolerance, monitoring next batch.', UPDATED_BY: 'TBERG', PHASE_ID: '0040' },
    ...(order.status === 'failed' ? [{ CREATED: start + 5.2 * HOUR, SENDER: 'T. BERG', NOTES: 'Viscosity OOS at sample S-003. Batch placed on QA hold pending CAPA.', UPDATED_BY: 'TBERG', PHASE_ID: '0040' }] : []),
  ];

  // Legacy timeline kept for the Timeline section — derived from real event sources
  const timeline = [
    { time: 'Created',    date: start - 18 * HOUR, event: 'Order created from MRP run',                            actor: 'SAP S/4 · auto',           state: 'done' },
    { time: 'Released',   date: start - 6 * HOUR,  event: 'Released to floor · raw materials picked',              actor: 'Planner: ' + order.operator, state: 'done' },
    { time: 'Setup',      date: start - 1 * HOUR,  event: 'Equipment cleaned · CIP verified',                      actor: 'Tech: J. Doyle',           state: 'done' },
    { time: 'Started',    date: start,             event: 'Batch start · all materials staged',                    actor: 'Operator: ' + order.operator, state: 'done' },
    { time: 'In-process', date: start + 2 * HOUR,  event: 'In-process QA sample passed · pH 6.4, moisture 3.2%',   actor: 'QA: T. Berg',              state: order.status === 'failed' ? 'warn' : 'done' },
    ...(order.status === 'failed'
      ? [{ time: 'Deviation', date: start + 4 * HOUR, event: 'Out-of-spec viscosity · batch held for review', actor: 'QA: T. Berg', state: 'fail' }]
      : []),
    ...(order.status === 'running'
      ? [{ time: 'Now', date: Date.now(), event: 'Batch in progress · 64% complete', actor: 'Operator: ' + order.operator, state: 'now' }]
      : (order.status === 'completed' || order.status === 'released')
        ? [
            { time: 'Completed', date: order.end, event: 'Batch finished · transferred to packaging', actor: 'Operator: ' + order.operator, state: 'done' },
            { time: 'Released',  date: order.end + 4 * HOUR, event: 'QA released · COA generated', actor: 'QA: T. Berg', state: 'done' },
          ]
        : []),
  ];

  // Materials — keep simple for the table; derived from movements ISSUE rows.
  // For each component, compute on-hand and a deterministic shortage flag.
  // Orders synthesized from a planning block with kind=='material-short' force the first 1-2 components to be short.
  const planningMaterials = order.__planningMaterials || null;
  const planningKind = order.__planningKind || null;
  const forceShortage = planningKind === 'material-short';
  const materials = components.map((c, idx) => {
    // Deterministic on-hand: between 30% and 180% of planned, based on component seed
    const cseed = (parseInt(c.matId, 10) + (parseInt(order.processOrderId || '0', 10) % 1000)) >>> 0;
    const onHandPct = 0.3 + ((cseed % 150) / 100);  // 0.3 .. 1.8
    let onHand = Math.round(c.planned * onHandPct * 10) / 10;
    let isShort = onHand < c.planned;
    let shortETA = null;
    if (forceShortage && idx < 2) {
      onHand = Math.round(c.planned * (0.05 + ((cseed % 25) / 100)) * 10) / 10;  // way under
      isShort = true;
      // Shortage ETA: 4-36h from order start
      shortETA = (order.start || Date.now()) + ((cseed % 32) + 4) * 3600 * 1000;
    } else if (isShort) {
      shortETA = (order.start || Date.now()) + ((cseed % 12) + 2) * 3600 * 1000;
    }
    return {
      name: c.name,
      sku: c.matId,
      planned: c.planned,
      used: c.used,
      unit: c.unit,
      onHand,
      isShort,
      shortETA,
      shortBy: isShort ? Math.max(0, c.planned - onHand) : 0,
    };
  });

  const docs = [
    { name: 'Master Batch Record (MBR)',         type: 'PDF',  size: '2.4 MB', date: 'Apr 25, 14:02' },
    { name: 'Certificate of Analysis (COA)',     type: 'PDF',  size: '486 KB', date: 'Apr 25, 18:45' },
    { name: 'In-process QA samples',             type: 'XLSX', size: '128 KB', date: 'Apr 25, 16:20' },
    { name: 'Equipment cleaning verification',   type: 'PDF',  size: '312 KB', date: 'Apr 25, 12:14' },
    { name: 'Operator deviation log',            type: 'PDF',  size: '94 KB',  date: 'Apr 25, 17:08' },
  ];

  return {
    timeline,
    materials,
    movements,
    movementSummary: { qtyIssuedKg, qtyReceivedKg, receiptUom: 'KG' },
    phases,
    confirmations,
    timeSummary: { setupS: totalSetupS, machS: totalMachS, cleanS: totalCleanS },
    inspections,
    inspectionLotId,
    usageDecision,
    downtime,
    equipment,
    comments,
    docs,
  };
}

export const KERRY_DATA: any = { ORDERS: ORDERS_LIST, STATUSES: STATUSES_LIST, buildDetail };

// ============================================================
// Planning Board data
// ============================================================
// Production lines — modeled after the equipment IDs that show up in vw_gold_equipment_history
const PLAN_LINES = [
  { id: 'MIX-04', name: 'Mixer Line A',     plant: 'RUN1', cap: 'BLEND/MIX',     shift: '24/7', maxKgH: 850 },
  { id: 'MIX-07', name: 'Mixer Line B',     plant: 'RUN1', cap: 'BLEND/MIX',     shift: '24/5', maxKgH: 720 },
  { id: 'SPD-02', name: 'Spray Dryer 2',    plant: 'RUN1', cap: 'SPRAY DRY',     shift: '24/7', maxKgH: 1100 },
  { id: 'SPD-05', name: 'Spray Dryer 5',    plant: 'BVL2', cap: 'SPRAY DRY',     shift: '24/7', maxKgH: 1300 },
  { id: 'PCK-12', name: 'Packing Line 12',  plant: 'RUN1', cap: 'PACKING',       shift: '12/5', maxKgH: 540 },
  { id: 'PCK-18', name: 'Packing Line 18',  plant: 'BVL2', cap: 'PACKING',       shift: '24/7', maxKgH: 620 },
  { id: 'EXT-03', name: 'Extruder 3',       plant: 'LND3', cap: 'EXTRUSION',     shift: '24/5', maxKgH: 480 },
  { id: 'CIP-01', name: 'CIP Skid 1',       plant: 'RUN1', cap: 'CLEANING',      shift: 'on-demand', maxKgH: null },
];

// Generate scheduled blocks across 7 days × 8 lines.
function buildPlanningData() {
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const NOW = ORDERS_LIST[0]?.start ? new Date('2025-04-25T08:00:00Z').getTime() : Date.now();
  // Anchor "today" at 00:00 of the most-recent order's date, so the board lines up with real orders
  const todayAnchor = new Date(NOW); todayAnchor.setUTCHours(0, 0, 0, 0);
  const today = todayAnchor.getTime();
  // 7-day window: 2 days back, today, 4 days forward
  const windowStart = today - 2 * DAY;
  const windowEnd = today + 5 * DAY;

  function r(seed) {
    let t = seed | 0;
    return () => {
      t = (t + 0x6D2B79F5) | 0;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Status palette for blocks: scheduled, running, completed, atrisk, changeover, maintenance
  const blocks = [];
  const PRODUCT_POOL = PRODUCTS;

  PLAN_LINES.forEach((line, li) => {
    const rnd = r(7919 + li * 31);
    let cursor = windowStart + Math.floor(rnd() * 6) * HOUR;
    let blockIdx = 0;

    while (cursor < windowEnd) {
      // Sometimes a changeover or CIP gap
      const gapKind = rnd();
      if (line.id === 'CIP-01') {
        // CIP line — short cleaning blocks 2-4h with idle gaps
        const dur = (2 + rnd() * 2) * HOUR;
        if (rnd() > 0.3) {
          blocks.push({
            id: `${line.id}-${blockIdx++}`,
            lineId: line.id,
            kind: 'cleaning',
            label: 'CIP cycle',
            sublabel: `${['MIX-04','MIX-07','SPD-02'][Math.floor(rnd()*3)]} → READY`,
            start: cursor,
            end: cursor + dur,
            qty: null, uom: null,
            poId: null, materialId: null, customer: null,
            shift: ['A','B','C'][Math.floor(rnd()*3)],
            operator: OPERATORS[Math.floor(rnd()*OPERATORS.length)],
          });
        }
        cursor += dur + (1 + rnd() * 4) * HOUR;
        continue;
      }

      // Occasional planned maintenance
      if (gapKind < 0.06) {
        const dur = (3 + rnd() * 3) * HOUR;
        blocks.push({
          id: `${line.id}-${blockIdx++}`,
          lineId: line.id,
          kind: 'maintenance',
          label: 'Planned maintenance',
          sublabel: rnd() > 0.5 ? 'PM-Q2 inspection' : 'Calibration',
          start: cursor,
          end: cursor + dur,
          qty: null, uom: null, poId: null, materialId: null, customer: null,
          shift: '—', operator: 'Maintenance crew',
        });
        cursor += dur + (0.5 + rnd() * 1) * HOUR;
        continue;
      }
      // Occasional changeover
      if (gapKind < 0.16) {
        const dur = (0.6 + rnd() * 0.8) * HOUR;
        blocks.push({
          id: `${line.id}-${blockIdx++}`,
          lineId: line.id,
          kind: 'changeover',
          label: 'Changeover',
          sublabel: 'Allergen cleanout',
          start: cursor,
          end: cursor + dur,
          qty: null, uom: null, poId: null, materialId: null, customer: null,
          shift: ['A','B','C'][Math.floor(rnd()*3)],
          operator: OPERATORS[Math.floor(rnd()*OPERATORS.length)],
        });
        cursor += dur + (0.1 + rnd() * 0.5) * HOUR;
        continue;
      }

      // Production block
      const product = PRODUCT_POOL[Math.floor(rnd() * PRODUCT_POOL.length)];
      const plannedQty = [500, 800, 1200, 1500, 2000, 2500, 3000][Math.floor(rnd() * 7)];
      const ratePerH = (line.maxKgH || 600) * (0.65 + rnd() * 0.3);
      const dur = Math.max(1.5 * HOUR, (plannedQty / ratePerH) * HOUR);
      const blockEnd = cursor + dur;
      const poId = (7006960000 + 137 * (li * 30 + blockIdx) + Math.floor(rnd() * 99)).toString();

      // Determine status by where this falls relative to NOW
      let kind;
      let materials = null;
      if (blockEnd < NOW) {
        kind = rnd() < 0.85 ? 'completed' : 'atrisk';
      } else if (cursor < NOW && blockEnd >= NOW) {
        kind = 'running';
      } else {
        // Future
        const roll = rnd();
        if (roll < 0.10) kind = 'firm';                  // released, locked
        else if (roll < 0.22) kind = 'material-short';   // material shortage
        else if (roll < 0.32) kind = 'atrisk';
        else kind = 'material-ready';                    // scheduled w/ all materials
      }

      // Generate material availability detail
      const mNames = ['Whey protein concentrate','Maltodextrin DE19','Citric acid mono','Natural flavour A412','Sea salt fine','Carrier blend C-22'];
      if (kind === 'material-short') {
        materials = mNames.slice(0, 3 + Math.floor(rnd() * 2)).map((n, idx) => ({
          name: n,
          required: Math.round(plannedQty * (0.05 + rnd() * 0.4)),
          onHand: idx === 0 ? Math.round(plannedQty * (0.01 + rnd() * 0.15)) : Math.round(plannedQty * (0.4 + rnd() * 0.6)),
          uom: 'kg',
        }));
        const eta = blockEnd + (4 + rnd() * 24) * HOUR;
        var shortageETA = eta;
        var shortageItem = materials[0].name;
      } else if (kind === 'material-ready' || kind === 'firm' || kind === 'running' || kind === 'atrisk') {
        materials = mNames.slice(0, 3 + Math.floor(rnd() * 2)).map(n => ({
          name: n,
          required: Math.round(plannedQty * (0.05 + rnd() * 0.4)),
          onHand: Math.round(plannedQty * (0.6 + rnd() * 0.8)),
          uom: 'kg',
        }));
      }

      blocks.push({
        id: `${line.id}-${blockIdx++}`,
        lineId: line.id,
        kind,
        label: product.cleanName,
        sublabel: product.matId + ' · ' + product.category,
        start: cursor,
        end: blockEnd,
        qty: plannedQty,
        uom: 'KG',
        poId,
        materialId: product.matId,
        customer: ['Tesco','Aldi','Walmart','Carrefour','Lidl','Coop'][Math.floor(rnd()*6)],
        shift: ['A','B','C'][Math.floor(rnd()*3)],
        operator: OPERATORS[Math.floor(rnd()*OPERATORS.length)],
        ratePerH: Math.round(ratePerH),
        materials,
        shortageETA: typeof shortageETA !== 'undefined' ? shortageETA : null,
        shortageItem: typeof shortageItem !== 'undefined' ? shortageItem : null,
      });
      cursor = blockEnd + (0.1 + rnd() * 0.4) * HOUR;
    }
  });

  // ---- Unplanned downtime ----
  // Two flavours:
  //   (a) Standalone past 'downtime' blocks that interrupted production (15min – 2.5h)
  //   (b) An 'activeDowntime' marker on a few currently-running blocks (operator just opened a fault)
  const DOWNTIME_REASONS = [
    { code: 'EQUIP-MECH', label: 'Mechanical fault',     detail: 'Sieve mesh blockage on packing line',  category: 'Equipment' },
    { code: 'EQUIP-ELEC', label: 'Electrical fault',     detail: 'VFD trip on mixer drive',              category: 'Equipment' },
    { code: 'PROC-CIP',   label: 'Extended CIP',         detail: 'Conductivity reading delayed return',  category: 'Process' },
    { code: 'MAT-WAIT',   label: 'Awaiting material',    detail: 'Awaiting QA release on incoming WPI',  category: 'Material' },
    { code: 'OPER-CHG',   label: 'Operator handover',    detail: 'Shift handover ran long',              category: 'Operator' },
    { code: 'QA-HOLD',    label: 'QA hold',              detail: 'In-process sample failed pH',          category: 'Quality' },
    { code: 'UTIL-AIR',   label: 'Compressed air loss',  detail: 'Plant compressor #2 tripped',          category: 'Utility' },
    { code: 'SAFETY',     label: 'Safety stop',          detail: 'Light curtain breach — reset',         category: 'Safety' },
  ];
  const downtimeBlocks = [];
  // Distribute ~12 standalone events across non-CIP lines in the past portion of the window
  const dtRnd = r(424242);
  const productionLines = PLAN_LINES.filter(l => l.id !== 'CIP-01');
  for (let i = 0; i < 12; i++) {
    const line = productionLines[Math.floor(dtRnd() * productionLines.length)];
    // Find a past production block on this line to "break"
    const lineBlocks = blocks.filter(b => b.lineId === line.id && b.kind === 'completed');
    if (lineBlocks.length === 0) continue;
    const host = lineBlocks[Math.floor(dtRnd() * lineBlocks.length)];
    const hostDur = host.end - host.start;
    if (hostDur < 1.5 * HOUR) continue;
    const reason = DOWNTIME_REASONS[Math.floor(dtRnd() * DOWNTIME_REASONS.length)];
    // Carve a 20–110 min slice somewhere in the middle of the host
    const dur = (20 + dtRnd() * 90) * 60 * 1000;
    const offset = 0.25 * hostDur + dtRnd() * (0.5 * hostDur);
    const dtStart = host.start + offset;
    const dtEnd = Math.min(dtStart + dur, host.end - 10 * 60 * 1000);
    if (dtEnd <= dtStart) continue;
    downtimeBlocks.push({
      id: `${line.id}-DT${i}`,
      lineId: line.id,
      kind: 'downtime',
      label: reason.label,
      sublabel: reason.detail,
      start: dtStart,
      end: dtEnd,
      qty: null, uom: null,
      poId: host.poId,
      materialId: host.materialId,
      customer: null,
      shift: host.shift,
      operator: host.operator,
      reasonCode: reason.code,
      reasonCategory: reason.category,
      hostPoId: host.poId,
      hostLabel: host.label,
    });
  }
  // Mark 1–2 currently-running blocks as having active downtime
  const runningBlocks = blocks.filter(b => b.kind === 'running');
  const activeCount = Math.min(2, runningBlocks.length);
  for (let i = 0; i < activeCount; i++) {
    const idx = Math.floor(dtRnd() * runningBlocks.length);
    const host = runningBlocks[idx];
    if (!host || host.activeDowntime) continue;
    const reason = DOWNTIME_REASONS[Math.floor(dtRnd() * DOWNTIME_REASONS.length)];
    const since = NOW - (5 + dtRnd() * 35) * 60 * 1000;
    host.activeDowntime = {
      since,
      durationMin: Math.round((NOW - since) / 60000),
      reasonCode: reason.code,
      reasonLabel: reason.label,
      reasonCategory: reason.category,
      detail: reason.detail,
    };
  }
  blocks.push(...downtimeBlocks);

  // WM Replenishment transfer orders — moves material from warehouse to line
  // Status: 'in-transit', 'delivered', 'pending', 'delayed'
  const wmTransfers = [];
  const wmStatuses = ['in-transit', 'delivered', 'pending', 'delayed', 'in-transit', 'delivered', 'pending'];
  const wmLines = ['MIX-04','MIX-07','SPD-02','SPD-05','PCK-12','PCK-18','EXT-03'];
  for (let i = 0; i < 22; i++) {
    const rt = r(50000 + i * 17);
    const lineId = wmLines[i % wmLines.length];
    const offset = (-2 + rt() * 7) * DAY + Math.floor(rt() * 12) * HOUR;
    const start = today + offset;
    const dur = (0.4 + rt() * 1.4) * HOUR;
    let status;
    if (start + dur < NOW) status = rt() < 0.85 ? 'delivered' : 'delayed';
    else if (start < NOW && start + dur >= NOW) status = 'in-transit';
    else status = rt() < 0.18 ? 'delayed' : (rt() < 0.45 ? 'in-transit' : 'pending');
    wmTransfers.push({
      id: `WMT-${(80024100 + i * 11).toString()}`,
      lineId,
      status,
      start,
      end: start + dur,
      materialId: ['MAT-103398','MAT-104482','MAT-202214','MAT-307711','MAT-118842'][i % 5],
      materialName: ['Whey protein concentrate','Maltodextrin DE19','Citric acid mono','Natural flavour A412','Sea salt fine'][i % 5],
      qty: [200, 400, 600, 800, 1200, 1600][Math.floor(rt() * 6)],
      uom: 'KG',
      sourceBin: ['WH-A1-' + Math.floor(rt() * 99), 'WH-B2-' + Math.floor(rt() * 99), 'WH-C3-' + Math.floor(rt() * 99)][i % 3],
      destBin: lineId + '-IN',
      forPoId: blocks.find(b => b.lineId === lineId && b.poId)?.poId || null,
    });
  }

  // Backlog — unscheduled orders waiting for a slot
  const backlog = [];
  for (let i = 0; i < 14; i++) {
    const rb = r(99991 + i * 13);
    const product = PRODUCT_POOL[i % PRODUCT_POOL.length];
    const qty = [600, 900, 1200, 1800, 2400, 3000][Math.floor(rb() * 6)];
    const due = today + Math.floor(rb() * 6) * DAY + Math.floor(rb() * 8) * HOUR;
    const priority = rb() < 0.18 ? 'urgent' : rb() < 0.5 ? 'high' : 'normal';
    backlog.push({
      id: `BL-${i+1}`,
      poId: (7006970000 + i * 53 + Math.floor(rb() * 19)).toString(),
      product: product.cleanName,
      materialId: product.matId,
      category: product.category,
      qty, uom: 'KG',
      due,
      priority,
      customer: ['Tesco','Aldi','Walmart','Carrefour','Lidl','Coop','Sainsbury'][i % 7],
      requiresLine: ['MIX-04','SPD-02','EXT-03','PCK-12','PCK-18'][i % 5],
      durationH: Math.round((qty / 600) * 10) / 10,
    });
  }

  // KPI summary
  const runningCount = blocks.filter(b => b.kind === 'running').length;
  const todaysBlocks = blocks.filter(b => b.start >= today && b.start < today + DAY && (b.kind === 'scheduled' || b.kind === 'firm' || b.kind === 'running' || b.kind === 'completed' || b.kind === 'atrisk'));
  const todaysQty = todaysBlocks.reduce((a, b) => a + (b.qty || 0), 0);

  // Capacity utilization for next 24h
  const horizonStart = NOW;
  const horizonEnd = NOW + DAY;
  let busyMs = 0; let totalMs = 0;
  PLAN_LINES.forEach(l => {
    if (l.id === 'CIP-01') return;
    totalMs += DAY;
    blocks.filter(b => b.lineId === l.id).forEach(b => {
      const s = Math.max(b.start, horizonStart);
      const e = Math.min(b.end, horizonEnd);
      if (e > s) busyMs += (e - s);
    });
  });
  const utilization = Math.round((busyMs / totalMs) * 100);

  // On-time %: completed blocks vs total ended blocks
  const ended = blocks.filter(b => b.end <= NOW && (b.kind === 'completed' || b.kind === 'atrisk'));
  const onTime = ended.filter(b => b.kind === 'completed').length;
  const onTimePct = ended.length ? Math.round((onTime / ended.length) * 100) : 100;

  // At-risk count
  const atRiskCount = blocks.filter(b => b.kind === 'atrisk' && b.end >= NOW).length;

  // Downtime — sum of past 24h standalone events + currently active
  const dt24hStart = NOW - 24 * HOUR;
  const downtimeBlocksToday = blocks.filter(b => b.kind === 'downtime' && b.end >= dt24hStart);
  const downtimeMinsToday =
    Math.round(downtimeBlocksToday.reduce((a, b) => a + (Math.min(b.end, NOW) - Math.max(b.start, dt24hStart)) / 60000, 0))
    + blocks.filter(b => b.activeDowntime).reduce((a, b) => a + b.activeDowntime.durationMin, 0);
  const activeDowntimeCount = blocks.filter(b => b.activeDowntime).length;

  return {
    lines: PLAN_LINES,
    blocks,
    backlog,
    wmTransfers,
    today,
    windowStart,
    windowEnd,
    NOW,
    kpis: {
      runningCount,
      totalLines: PLAN_LINES.length - 1,  // exclude CIP
      todaysQty,
      todaysCount: todaysBlocks.length,
      utilization,
      onTimePct,
      atRiskCount,
      backlogCount: backlog.length,
      backlogUrgent: backlog.filter(b => b.priority === 'urgent').length,
      materialReadyCount: blocks.filter(b => b.kind === 'material-ready' && b.end >= NOW).length,
      materialShortCount: blocks.filter(b => b.kind === 'material-short' && b.end >= NOW).length,
      downtimeMinsToday,
      activeDowntimeCount,
      wmInTransit: wmTransfers.filter(w => w.status === 'in-transit').length,
      wmDelayed: wmTransfers.filter(w => w.status === 'delayed' && w.end >= NOW).length,
    },
  };
}

KERRY_DATA.buildPlanningData = buildPlanningData;
KERRY_DATA.PLAN_LINES = PLAN_LINES;

// ============================================================
//  POURS — Liquid blending domain. A "pour" is one goods-issue:
//  a single tank/IBC/tote of a raw material decanted into the
//  process. We model:
//    - a per-line target (planned pours per 24h based on shift cap)
//    - the planned pours for POs scheduled in the last 24h
//    - the actual logged pours in the last 24h (with operator,
//      shift, line, source area)
//    - 30-day daily series, 24-hour hourly series
// ============================================================
function buildPoursData() {
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const NOW = Date.now();

  // Lines that perform pours (exclude CIP — non-production)
  const lines = PLAN_LINES.filter(l => l.id !== 'CIP-01').map(l => ({
    id: l.id, name: l.name, plant: l.plant
  }));
  const SHIFTS = ['A', 'B', 'C'];
  const SOURCE_AREAS = ['Tank Farm North', 'Tank Farm South', 'Tote Bay', 'IBC Cage', 'Bulk Silo Row', 'Day Tanks'];

  // Each line has a target pours-per-24h. Lines with bigger maxKgH = more pours.
  const linesWithTarget = lines.map(l => {
    const orig = PLAN_LINES.find(pl => pl.id === l.id);
    const target = Math.round((orig.maxKgH || 600) / 18);  // ~50 pours/day on biggest lines
    return { ...l, target };
  });
  const totalTarget = linesWithTarget.reduce((a, l) => a + l.target, 0);

  // Seeded RNG for repeatability
  function r(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; }; }
  const rng = r(91827);

  // Generate pour events for the last 31 days
  const pours = [];
  let pourIdx = 0;
  for (let dayBack = 31; dayBack >= 0; dayBack--) {
    const dayStart = NOW - dayBack * DAY;
    // Daily volume: hits target ±20%, weekend ~70%
    const date = new Date(dayStart);
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const dailyMult = (isWeekend ? 0.65 : 0.95) + (rng() - 0.5) * 0.4;
    linesWithTarget.forEach(line => {
      const linePours = Math.max(0, Math.round(line.target * dailyMult * (0.85 + rng() * 0.3)));
      for (let i = 0; i < linePours; i++) {
        const tOffset = rng() * DAY;
        const t = dayStart + tOffset;
        if (t > NOW) continue;
        const hour = new Date(t).getUTCHours();
        const shift = hour < 8 ? 'C' : hour < 16 ? 'A' : 'B';
        pours.push({
          id: 'PR-' + (700000 + pourIdx++).toString(),
          ts: t,
          lineId: line.id,
          lineName: line.name,
          shift,
          operator: OPERATORS[Math.floor(rng() * OPERATORS.length)],
          sourceArea: SOURCE_AREAS[Math.floor(rng() * SOURCE_AREAS.length)],
          materialId: PRODUCTS[Math.floor(rng() * PRODUCTS.length)].matId,
          qty: Math.round((50 + rng() * 950) * 10) / 10,  // kg
          uom: 'KG',
          poId: '700' + (6960000 + Math.floor(rng() * 999999)).toString().slice(-7),
        });
      }
    });
  }
  pours.sort((a, b) => a.ts - b.ts);

  // Last-24h actuals
  const t24h = NOW - 24 * HOUR;
  const last24 = pours.filter(p => p.ts >= t24h);
  // Planned pours for POs scheduled to start in last 24h:
  // approximate by inflating last24 actual by miss-rate (~14% of plan unfulfilled)
  const plannedLast24 = Math.round(last24.length / 0.86);

  // 30-day daily series
  const daily30d = [];
  for (let dayBack = 29; dayBack >= 0; dayBack--) {
    const ds = NOW - (dayBack + 1) * DAY;
    const de = NOW - dayBack * DAY;
    const dayPours = pours.filter(p => p.ts >= ds && p.ts < de);
    daily30d.push({
      date: ds,
      actual: dayPours.length,
      target: totalTarget,
      planned: Math.round(dayPours.length / (0.84 + Math.random() * 0.08)),
    });
  }

  // 24-hour hourly series
  const hourly24h = [];
  for (let hBack = 23; hBack >= 0; hBack--) {
    const hs = NOW - (hBack + 1) * HOUR;
    const he = NOW - hBack * HOUR;
    const hourPours = pours.filter(p => p.ts >= hs && p.ts < he);
    hourly24h.push({
      hour: hs,
      actual: hourPours.length,
      target: Math.round(totalTarget / 24),
    });
  }

  return {
    NOW,
    pours,                  // full event log
    last24,                 // last 24h events
    lines: linesWithTarget,
    shifts: SHIFTS,
    sourceAreas: SOURCE_AREAS,
    operators: OPERATORS.slice(),
    kpis: {
      targetPer24h: totalTarget,
      plannedLast24h: plannedLast24,
      actualLast24h: last24.length,
    },
    daily30d,
    hourly24h,
  };
}

KERRY_DATA.buildPoursData = buildPoursData;

export { ORDERS_LIST as ORDERS, STATUSES_LIST as STATUSES, buildDetail, buildPlanningData, buildPoursData, PLAN_LINES };
