/* ============================================================
   Warehouse Manager 360° — Mock SAP WM data
   Kerry Naas (Savoury/Taste) site · SAP ECC / WM on Databricks
   Generated deterministically so rows stay stable between renders.
   ============================================================ */

// Warehouse Manager 360° mock data
  // Seeded RNG for stable data
  let _seed = 42;
  const rng = () => {
    _seed = (_seed * 9301 + 49297) % 233280;
    return _seed / 233280;
  };
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const range = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const chance = (p) => rng() < p;

  // ---- Reference data --------------------------------------
  const PLANT = 'IE01 · Kerry Naas Savoury';
  const WAREHOUSE = 'NS01';
  const SHIFTS = [
    { id: 'A', label: 'Shift A', hours: '06:00–14:00' },
    { id: 'B', label: 'Shift B', hours: '14:00–22:00' },
    { id: 'C', label: 'Shift C', hours: '22:00–06:00' },
  ];

  const LINES = [
    { id: 'PL01', name: 'Savoury Line 1', type: 'Seasoning blend', area: 'North Hall' },
    { id: 'PL02', name: 'Savoury Line 2', type: 'Coating powder', area: 'North Hall' },
    { id: 'PL03', name: 'Savoury Line 3', type: 'Soup base', area: 'North Hall' },
    { id: 'PL04', name: 'Dispensary Line', type: 'Weighed micros', area: 'Dispensary' },
    { id: 'PL05', name: 'Bulk Blender', type: 'Macro ingredients', area: 'Bulk Bay' },
    { id: 'PL06', name: 'Packaging Line A', type: 'Sachet fill', area: 'Pack Hall' },
    { id: 'PL07', name: 'Packaging Line B', type: 'Drum fill', area: 'Pack Hall' },
  ];

  const STORAGE_TYPES = [
    { id: '001', name: 'High Rack RM', desc: 'Raw material pallet storage' },
    { id: '002', name: 'Bulk Bay', desc: 'Bulk drop area' },
    { id: '003', name: 'Dispensary', desc: 'Weighed micro ingredients' },
    { id: '005', name: 'Line Side', desc: 'Production line-side stock' },
    { id: '010', name: 'Quarantine', desc: 'Blocked / QA hold' },
    { id: '050', name: 'Shipping Staging', desc: 'FG ready to load' },
    { id: '915', name: 'Interim Receiving', desc: 'GR hold before putaway' },
  ];

  const DOCKS = [
    { id: 'D01', type: 'Inbound', lane: 1 },
    { id: 'D02', type: 'Inbound', lane: 2 },
    { id: 'D03', type: 'Inbound', lane: 3 },
    { id: 'D04', type: 'Inbound', lane: 4 },
    { id: 'D05', type: 'Outbound', lane: 1 },
    { id: 'D06', type: 'Outbound', lane: 2 },
    { id: 'D07', type: 'Outbound', lane: 3 },
    { id: 'D08', type: 'Outbound', lane: 4 },
  ];

  // ---- Materials (MARA) ------------------------------------
  const MATERIAL_FAMILIES = [
    { prefix: 'RM-SEAS', name: 'Seasoning Blend', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-SALT', name: 'Food-grade Salt', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-ONION', name: 'Dried Onion Powder', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-GARLIC', name: 'Dried Garlic Granules', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-YEAST', name: 'Yeast Extract', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-PEPR', name: 'White Pepper Powder', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-PAP', name: 'Paprika', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-MSG', name: 'Monosodium Glutamate', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-MALT', name: 'Maltodextrin', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-STARCH', name: 'Modified Starch', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-CHIX', name: 'Chicken Flavour Base', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-BEEF', name: 'Beef Extract Powder', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-HVP', name: 'Hydrolysed Veg Protein', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-TOM', name: 'Tomato Powder', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-CELERY', name: 'Celery Powder', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-ACID', name: 'Citric Acid', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-OIL', name: 'Rapeseed Oil Powder', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-HERB', name: 'Dried Herb Blend', uom: 'KG', category: 'Raw Material' },
    { prefix: 'RM-SUG', name: 'Dextrose', uom: 'KG', category: 'Raw Material' },
    { prefix: 'PM-FOIL', name: 'Foil Sachet Laminate', uom: 'RL', category: 'Packaging' },
    { prefix: 'PM-DRUM', name: 'Fibre Drum 25kg', uom: 'EA', category: 'Packaging' },
  ];
  const MATERIALS = [];
  for (let i = 0; i < MATERIAL_FAMILIES.length; i++) {
    const f = MATERIAL_FAMILIES[i];
    MATERIALS.push({
      id: f.prefix + '-' + String(100 + i).padStart(4, '0'),
      name: f.name,
      uom: f.uom,
      category: f.category,
      batchManaged: f.category === 'Raw Material',
    });
  }

  const VENDORS = [
    { id: '0010023', name: 'Ornua Ingredients Ltd', country: 'IE' },
    { id: '0010088', name: 'Döhler Süd GmbH', country: 'DE' },
    { id: '0010142', name: 'Symrise Flavours AG', country: 'DE' },
    { id: '0010301', name: 'Olam Food Ingredients', country: 'NL' },
    { id: '0010477', name: 'Glanbia Nutritionals', country: 'IE' },
    { id: '0010599', name: 'Archer Daniels Midland', country: 'UK' },
    { id: '0010812', name: 'Tate & Lyle plc', country: 'UK' },
    { id: '0010945', name: 'Corbion Ingredients', country: 'NL' },
  ];

  const CUSTOMERS = [
    { id: 'C20011', name: 'Nestlé — Wyeth Askeaton' },
    { id: 'C20034', name: 'Tesco Ireland' },
    { id: 'C20058', name: 'Unilever — Leatherhead' },
    { id: 'C20099', name: 'McDonald\u2019s Supply — Taunton' },
    { id: 'C20142', name: 'Diageo — St James\u2019s Gate' },
    { id: 'C20189', name: 'KFC Europe DC' },
    { id: 'C20231', name: 'Greencore — Manchester' },
    { id: 'C20277', name: 'Mondelez — Reading' },
  ];

  const SENDING_PLANTS = [
    { id: 'IE02', name: 'Kerry Charleville' },
    { id: 'IE05', name: 'Kerry Listowel Dairy' },
    { id: 'UK12', name: 'Kerry Menstrie' },
    { id: 'NL03', name: 'Kerry Bergambacht' },
  ];

  // ---- Time helpers ----------------------------------------
  const NOW = new Date();
  NOW.setHours(10, 34, 0, 0); // fix 'now' at 10:34 today for determinism of layout
  const todayAt = (h, m = 0) => {
    const d = new Date(NOW);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const shiftTime = (d, mins) => new Date(d.getTime() + mins * 60000);
  const fmtTime = (d) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const fmtDateTime = (d) =>
    d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const minutesFromNow = (d) => Math.round((d.getTime() - NOW.getTime()) / 60000);
  const hoursFromNow = (d) => Math.round((d.getTime() - NOW.getTime()) / 3600000 * 10) / 10;

  // ---- Process Orders + Staging (AFKO/AFPO/RESB) -----------
  const STAGING_METHODS = [
    { id: 'std', label: 'Standard staging', desc: 'Process-order specific, pallet-level' },
    { id: 'cons', label: 'Consolidated staging', desc: 'Line & date based consolidation' },
    { id: 'bulk', label: 'Bulk drop', desc: 'Bulk pallet dropped at line' },
    { id: 'disp', label: 'Dispensary', desc: 'Weighed partial materials' },
    { id: 'combo', label: 'WH + Dispensary', desc: 'Combined pallet + weighed' },
    { id: 'fast', label: 'Fast-mover replen', desc: 'Manual min/max top-up' },
    { id: 'sscc', label: 'SSCC pallet', desc: 'HU-managed full pallet' },
    { id: 'camp', label: 'Campaign', desc: 'Multi-order shared staging' },
  ];

  const RISKS = ['red', 'amber', 'green'];

  // Build ~60 production orders spanning yesterday 20:00 → tomorrow 06:00
  const PROCESS_ORDERS = [];
  const PROD_PRODUCTS = [
    'BBQ Chicken Seasoning · 50kg',
    'Paprika Coating Blend · 25kg',
    'Tomato Soup Base · 100kg',
    'Beef Gravy Seasoning · 40kg',
    'Mediterranean Herb Blend · 30kg',
    'Cheese & Onion Topping · 50kg',
    'Salt & Vinegar Seasoning · 25kg',
    'Garlic Butter Rub · 20kg',
    'Piri Piri Coating · 35kg',
    'Curry Powder Premix · 80kg',
    'Chicken Stock Base · 60kg',
    'Smoky Bacon Seasoning · 45kg',
    'Southern Fried Coating · 100kg',
    'Thai Green Base · 40kg',
    'Onion & Chive Mix · 30kg',
  ];

  for (let i = 0; i < 62; i++) {
    const startMinutes = -14 * 60 + i * 35 + range(-10, 10); // spans roughly -14h..+21h
    const start = new Date(NOW.getTime() + startMinutes * 60000);
    const durationMin = pick([45, 60, 75, 90, 120, 150, 180]);
    const end = new Date(start.getTime() + durationMin * 60000);
    const method = pick(STAGING_METHODS);
    const line = pick(LINES.filter((l) => l.area !== 'Pack Hall'));
    const stagingPct = chance(0.7) ? range(55, 100) : range(10, 60);
    let risk;
    if (startMinutes < -30 && stagingPct < 100) risk = 'red';
    else if (startMinutes >= 0 && startMinutes < 120 && stagingPct < 90) risk = 'red';
    else if (startMinutes >= 0 && startMinutes < 240 && stagingPct < 95) risk = 'amber';
    else if (startMinutes < 0 && stagingPct === 100) risk = 'green';
    else risk = pick(['green', 'green', 'amber']);

    // status
    let status;
    if (end.getTime() < NOW.getTime()) status = 'Completed';
    else if (start.getTime() < NOW.getTime()) status = 'In Production';
    else if (stagingPct === 100) status = 'Staged';
    else if (stagingPct >= 50) status = 'Staging';
    else status = 'Scheduled';

    PROCESS_ORDERS.push({
      id: 'PO' + String(1000400 + i).padStart(7, '0'),
      sapOrder: '4000' + String(10000 + i),
      product: PROD_PRODUCTS[i % PROD_PRODUCTS.length],
      material: MATERIALS[(i * 3) % MATERIALS.length],
      line,
      shift: SHIFTS[(Math.floor((start.getHours() + 2) / 8)) % 3],
      start,
      end,
      duration: durationMin,
      method,
      stagingPct,
      bomCount: range(4, 14),
      bomPicked: 0, // computed below
      pallets: range(3, 24),
      palletsStaged: 0,
      risk,
      status,
      dispensaryRequired: method.id === 'disp' || method.id === 'combo' || chance(0.25),
      batchCritical: chance(0.3),
      notes: pick([null, null, 'Allergen changeover before start', 'Sample hold lifted 09:20', null, 'Line CIP completed']),
    });
    const po = PROCESS_ORDERS[PROCESS_ORDERS.length - 1];
    po.bomPicked = Math.floor((po.bomCount * stagingPct) / 100);
    po.palletsStaged = Math.floor((po.pallets * stagingPct) / 100);
  }

  // ---- Transfer Requirements (LTBK/LTBP) --------------------
  const TRs = [];
  for (let i = 0; i < 140; i++) {
    const po = PROCESS_ORDERS[i % PROCESS_ORDERS.length];
    const mat = MATERIALS[(i * 7) % MATERIALS.length];
    const status = pick(['Open', 'Open', 'In Process', 'Partially Confirmed', 'Confirmed', 'Confirmed', 'Confirmed']);
    const createdMins = -range(5, 600);
    TRs.push({
      id: '040' + String(120000 + i),
      po: po.id,
      material: mat,
      qty: range(20, 400),
      uom: mat.uom,
      srcType: '001',
      dstType: pick(['005', '005', '002', '003']),
      status,
      ageMin: -createdMins,
      created: new Date(NOW.getTime() + createdMins * 60000),
      prio: pick([1, 2, 2, 2, 3, 3, 4, 5]),
    });
  }

  // ---- Transfer Orders (LTAK/LTAP) --------------------------
  const TOs = [];
  const TO_TYPES = ['Pick', 'Putaway', 'Replen', 'Internal'];
  for (let i = 0; i < 220; i++) {
    const mat = MATERIALS[(i * 5) % MATERIALS.length];
    const status = pick(['Open', 'Open', 'In Process', 'In Process', 'Confirmed', 'Confirmed', 'Confirmed', 'Partially Confirmed', 'Exception']);
    const ageMin = range(1, 680);
    TOs.push({
      id: '002' + String(345000 + i),
      type: pick(TO_TYPES),
      material: mat,
      qty: range(1, 20),
      uom: mat.uom === 'KG' ? 'PAL' : mat.uom,
      srcBin: pick(['01-A-04', '01-B-12', '02-C-08', '01-D-22', '03-F-01']),
      dstBin: pick(['05-PL01', '05-PL02', '05-PL03', '02-BLK01', '03-DSP04']),
      status,
      ageMin,
      assignedTo: pick([null, 'MCARTHY', 'OBRIEN', 'NGUYEN', 'KOWALSK', 'MURPHY', 'DALY', 'SWEENEY']),
      sscc: '00340123' + String(4500 + i).padStart(8, '0'),
    });
  }

  // ---- Purchase Orders (EKKO/EKPO) + Inbound Receipts ------
  const PO_RECEIPTS = [];
  for (let i = 0; i < 42; i++) {
    const mat = MATERIALS[(i * 11) % MATERIALS.length];
    const v = VENDORS[i % VENDORS.length];
    const expectedQty = range(400, 4000);
    const arriveMins = -8 * 60 + i * 35 + range(-15, 25);
    const eta = new Date(NOW.getTime() + arriveMins * 60000);
    let receivedQty;
    let status;
    let risk = 'green';
    if (arriveMins < -240) {
      receivedQty = expectedQty;
      status = 'Put away';
    } else if (arriveMins < -120) {
      receivedQty = chance(0.7) ? expectedQty : Math.floor(expectedQty * 0.7);
      status = chance(0.7) ? 'Put away' : 'Awaiting Putaway';
      if (receivedQty < expectedQty * 0.9) risk = 'amber';
    } else if (arriveMins < 0) {
      receivedQty = chance(0.6) ? expectedQty : Math.floor(expectedQty * range(60, 95) / 100);
      status = pick(['GR Posted', 'At Dock', 'Awaiting Putaway']);
      if (receivedQty < expectedQty * 0.9) risk = 'amber';
    } else {
      receivedQty = 0;
      status = chance(0.1) ? 'Overdue' : 'Expected';
      if (status === 'Overdue') risk = 'red';
    }
    const qaStatus = pick(['Released', 'Released', 'Released', 'QA Hold', 'Inspection']);
    if (qaStatus === 'QA Hold') risk = 'red';

    PO_RECEIPTS.push({
      id: '4500' + String(200000 + i),
      type: 'PO',
      vendor: v,
      material: mat,
      expectedQty,
      receivedQty,
      uom: mat.uom,
      eta,
      dock: DOCKS.filter((d) => d.type === 'Inbound')[i % 4],
      status,
      qa: qaStatus,
      risk,
      batches: chance(0.6) ? range(1, 4) : 1,
      sscc: chance(0.7),
      neededForToday: chance(0.35),
      puc: chance(0.8) ? range(0, 100) : 0, // putaway completion %
    });
  }

  // ---- STO Receipts ----------------------------------------
  const STO_RECEIPTS = [];
  for (let i = 0; i < 18; i++) {
    const mat = MATERIALS[(i * 13) % MATERIALS.length];
    const sp = SENDING_PLANTS[i % SENDING_PLANTS.length];
    const expectedQty = range(600, 5000);
    const arriveMins = -6 * 60 + i * 70 + range(-20, 20);
    const eta = new Date(NOW.getTime() + arriveMins * 60000);
    let receivedQty;
    let status;
    let risk = 'green';
    if (arriveMins < -180) {
      receivedQty = expectedQty;
      status = 'Put away';
    } else if (arriveMins < 0) {
      receivedQty = chance(0.7) ? expectedQty : Math.floor(expectedQty * range(50, 95) / 100);
      status = pick(['GR Posted', 'At Dock', 'Awaiting Putaway']);
      if (receivedQty < expectedQty * 0.9) risk = 'amber';
    } else {
      receivedQty = 0;
      status = chance(0.15) ? 'Overdue' : 'Expected';
      if (status === 'Overdue') risk = 'red';
    }
    STO_RECEIPTS.push({
      id: '4500' + String(500000 + i),
      type: 'STO',
      vendor: { id: sp.id, name: sp.name, country: 'IE' },
      material: mat,
      expectedQty,
      receivedQty,
      uom: mat.uom,
      eta,
      dock: DOCKS.filter((d) => d.type === 'Inbound')[i % 4],
      status,
      qa: pick(['Released', 'Released', 'Released', 'QA Hold']),
      risk,
      batches: range(1, 3),
      sscc: true,
      neededForToday: chance(0.4),
      puc: range(0, 100),
    });
  }

  const INBOUND = [...PO_RECEIPTS, ...STO_RECEIPTS].sort((a, b) => a.eta - b.eta);

  // ---- Outbound Deliveries (LIKP/LIPS) ---------------------
  const DELIVERIES = [];
  const DELIVERY_STATUSES = ['Open', 'Picking', 'Staged', 'Loading', 'Loaded', 'Shipped'];
  for (let i = 0; i < 38; i++) {
    const cust = CUSTOMERS[i % CUSTOMERS.length];
    const cutoffMins = -2 * 60 + i * 45 + range(-20, 20);
    const cutoff = new Date(NOW.getTime() + cutoffMins * 60000);
    const dock = DOCKS.filter((d) => d.type === 'Outbound')[i % 4];
    const pickPct = cutoffMins < -90 ? 100 : cutoffMins < 60 ? range(55, 100) : range(10, 70);
    const stagePct = pickPct < 100 ? Math.max(0, pickPct - range(5, 15)) : chance(0.7) ? 100 : range(70, 95);
    const loadPct = stagePct < 100 ? 0 : cutoffMins < -30 ? range(60, 100) : range(0, 40);
    let status;
    if (cutoffMins < -120) status = 'Shipped';
    else if (loadPct === 100) status = 'Loaded';
    else if (loadPct > 0) status = 'Loading';
    else if (stagePct === 100) status = 'Staged';
    else if (pickPct > 0) status = 'Picking';
    else status = 'Open';

    let risk = 'green';
    if (cutoffMins < 90 && pickPct < 80) risk = 'red';
    else if (cutoffMins < 180 && pickPct < 90) risk = 'amber';
    if (status === 'Shipped') risk = 'green';

    const lines = range(3, 16);
    DELIVERIES.push({
      id: '800' + String(40000 + i),
      so: '50' + String(60000 + i),
      customer: cust,
      cutoff,
      dock,
      carrier: pick(['DHL Ireland', 'DFDS Logistics', 'Nightline', 'Wincanton', 'Maersk Road', 'XPO Europe']),
      status,
      risk,
      pickPct,
      stagePct,
      loadPct,
      lines,
      linesDone: Math.floor(lines * pickPct / 100),
      weight: range(800, 18000),
      pallets: range(3, 26),
      hu: chance(0.85),
      shortPicks: chance(0.2) ? range(1, 3) : 0,
    });
  }

  // ---- Storage Bins (LAGP) + Quants (LQUA) -----------------
  const STORAGE_BINS = [];
  for (const sType of STORAGE_TYPES) {
    const count = sType.id === '001' ? 540 : sType.id === '002' ? 48 : sType.id === '003' ? 120 : sType.id === '005' ? 84 : sType.id === '050' ? 60 : sType.id === '010' ? 36 : 60;
    for (let i = 0; i < count; i++) {
      const aisle = String.fromCharCode(65 + (i % 8)); // A..H
      const rack = String(Math.floor(i / 8) + 1).padStart(2, '0');
      const level = (i % 5) + 1;
      const filled = rng();
      STORAGE_BINS.push({
        id: `${sType.id}-${aisle}${rack}-L${level}`,
        storageType: sType,
        aisle, rack, level,
        status: pick(['Free', 'Occupied', 'Occupied', 'Occupied', 'Occupied', 'Blocked']),
        fillPct: filled < 0.12 ? 0 : Math.min(100, filled * 120),
        material: chance(0.8) ? MATERIALS[Math.floor(rng() * MATERIALS.length)] : null,
        ageHours: range(1, 240),
        batchExpiryDays: range(3, 420),
      });
    }
  }

  // ---- Line-side stock -------------------------------------
  const LINE_SIDE = [];
  for (const line of LINES) {
    for (let i = 0; i < 4; i++) {
      const mat = MATERIALS[((line.id.charCodeAt(2) * (i + 1)) % MATERIALS.length)];
      const current = range(5, 400);
      const min = range(20, 60);
      const max = range(100, 300);
      LINE_SIDE.push({
        line, material: mat, current, min, max,
        status: current < min ? 'Below min' : current > max * 0.9 ? 'OK' : current > min * 1.2 ? 'OK' : 'Near min',
      });
    }
  }

  // ---- Dispensary tasks ------------------------------------
  const DISP_TASKS = [];
  const DISPENSERS = ['O\u2019Brien E.', 'Kowalski P.', 'Nguyen T.', 'Murphy R.', 'Daly S.', 'Sweeney L.', 'McCarthy J.'];
  for (let i = 0; i < 36; i++) {
    const po = pick(PROCESS_ORDERS.filter((p) => p.dispensaryRequired));
    const mat = MATERIALS[(i * 17) % MATERIALS.length];
    const qty = +(range(5, 5000) / 1000).toFixed(3);
    const requiredBy = new Date(po.start.getTime() - 30 * 60000);
    const status = pick(['To Do', 'To Do', 'Weighing', 'Weighed', 'Weighed', 'To Do', 'Check']);
    const weighedQty = status === 'Weighed' || status === 'Check' ? +(qty * (1 + (rng() - 0.5) * 0.01)).toFixed(3) : 0;
    DISP_TASKS.push({
      id: 'DSP-' + String(80000 + i),
      po: po ? po.id : null,
      line: po ? po.line : LINES[3],
      material: mat,
      qty,
      weighedQty,
      tol: 0.005,
      requiredBy,
      status,
      operator: status === 'To Do' ? null : pick(DISPENSERS),
      scale: pick(['SC-01', 'SC-02', 'SC-03', 'SC-04']),
      batch: 'B' + String(300000 + i),
    });
  }

  // ---- Handling Units / SSCC (VEKP/VEPO) -------------------
  const HUs = [];
  for (let i = 0; i < 80; i++) {
    const mat = MATERIALS[(i * 19) % MATERIALS.length];
    HUs.push({
      sscc: '00340123' + String(700000 + i).padStart(9, '0'),
      material: mat,
      qty: range(50, 900),
      uom: mat.uom,
      bin: pick(STORAGE_BINS.slice(0, 200)).id,
      status: pick(['Active', 'Active', 'Active', 'In Transit', 'On Line', 'Sealed']),
      lastScan: new Date(NOW.getTime() - range(5, 720) * 60000),
    });
  }

  // ---- Exceptions (modelled from real events) --------------
  const EXCEPTIONS = [];
  const EX_TYPES = [
    { id: 'staging-late', severity: 'critical', title: 'Production starts in < 2h · staging incomplete', domain: 'Production Staging' },
    { id: 'disp-not-started', severity: 'critical', title: 'Dispensary task not started · required in < 1h', domain: 'Dispensary' },
    { id: 'bulk-drop-uncleared', severity: 'high', title: 'Bulk drop delivered · not consumed / not returned', domain: 'Production Staging' },
    { id: 'sscc-missing', severity: 'high', title: 'SSCC missing on staged pallet', domain: 'Production Staging' },
    { id: 'to-ageing', severity: 'medium', title: 'Transfer Order open > 4h', domain: 'Warehouse Tasks' },
    { id: 'pick-not-delivered', severity: 'high', title: 'Pick confirmed but not delivered to line', domain: 'Outbound' },
    { id: 'inbound-overdue', severity: 'high', title: 'Inbound receipt overdue · needed for production today', domain: 'Inbound' },
    { id: 'putaway-backlog', severity: 'medium', title: 'GR posted · awaiting putaway > 2h', domain: 'Inbound' },
    { id: 'delivery-pick-incomplete', severity: 'critical', title: 'Outbound delivery cut-off < 2h · pick incomplete', domain: 'Outbound' },
    { id: 'stock-no-bin', severity: 'high', title: 'Stock in SAP but no available bin qty', domain: 'Inventory' },
    { id: 'batch-mismatch', severity: 'critical', title: 'Batch mismatch · picked vs reserved', domain: 'Inventory' },
    { id: 'lineside-below-min', severity: 'high', title: 'Line-side stock below minimum', domain: 'Production Staging' },
    { id: 'qa-hold', severity: 'medium', title: 'QA Hold active on material needed today', domain: 'Inventory' },
  ];

  for (let i = 0; i < 44; i++) {
    const t = EX_TYPES[i % EX_TYPES.length];
    const ageMin = range(3, 360);
    const po = chance(0.7) ? pick(PROCESS_ORDERS) : null;
    const del = chance(0.4) ? pick(DELIVERIES) : null;
    const mat = pick(MATERIALS);
    EXCEPTIONS.push({
      id: 'EX-' + String(90000 + i),
      type: t,
      ageMin,
      po,
      del,
      material: mat,
      line: po ? po.line : pick(LINES),
      detail: pick([
        'Staging only 62% complete',
        'Dispensary task DSP-80034 untouched',
        'HU 003401237004521 flagged mismatch',
        'Vendor ETA slipped 2h',
        'Pick TO 002345120 idle on floor',
        '3 of 8 materials still open',
        'QA inspection required before use',
      ]),
      owner: pick([null, 'Shift A Supervisor', 'Inbound Lead', 'Dispensary Lead', 'Outbound Lead']),
      acknowledged: chance(0.2),
    });
  }

  // ---- Warehouse Task Workload (by area) -------------------
  const WORKLOAD = [
    { area: 'Inbound', open: 18, inProgress: 9, confirmed: 41, exceptions: 3 },
    { area: 'Putaway', open: 12, inProgress: 6, confirmed: 28, exceptions: 2 },
    { area: 'Staging (RM)', open: 24, inProgress: 11, confirmed: 52, exceptions: 5 },
    { area: 'Dispensary', open: 8, inProgress: 3, confirmed: 19, exceptions: 2 },
    { area: 'Bulk Drop', open: 4, inProgress: 2, confirmed: 11, exceptions: 1 },
    { area: 'Line Side Replen', open: 9, inProgress: 4, confirmed: 22, exceptions: 0 },
    { area: 'Outbound Pick', open: 15, inProgress: 8, confirmed: 34, exceptions: 4 },
    { area: 'Loading', open: 6, inProgress: 2, confirmed: 9, exceptions: 1 },
  ];

  // ---- KPI summary ----------------------------------------
  const KPIs = {
    stagingSLA: { value: 92, target: 95, trend: -1.2, unit: '%' },
    prodOnTime: { value: 88, target: 98, trend: +2.1, unit: '%' },
    inboundAdherence: { value: 84, target: 90, trend: -3.4, unit: '%' },
    putawayCycle: { value: 47, target: 60, trend: -8, unit: 'min' },
    outboundReady: { value: 96, target: 98, trend: +0.8, unit: '%' },
    pickProd: { value: 142, target: 130, trend: +6, unit: 'ln/h' },
    toAgeing: { value: 14, target: 20, trend: -2, unit: 'TOs' },
    binUtil: { value: 78, target: 80, trend: +1.1, unit: '%' },
    inventoryAccuracy: { value: 99.4, target: 99.5, trend: +0.1, unit: '%' },
    dispensaryReady: { value: 93, target: 95, trend: +1.6, unit: '%' },
    ssccCompliance: { value: 99.1, target: 99.5, trend: -0.2, unit: '%' },
    leftoverReturn: { value: 2.4, target: 2, trend: -0.3, unit: '%' },
    stockoutRate: { value: 1.8, target: 1, trend: +0.4, unit: '%' },
  };

  // expose
const WM = {
    NOW, todayAt, shiftTime, fmtTime, fmtDateTime, minutesFromNow, hoursFromNow,
    PLANT, WAREHOUSE, SHIFTS, LINES, STORAGE_TYPES, DOCKS,
    MATERIALS, VENDORS, CUSTOMERS, SENDING_PLANTS,
    STAGING_METHODS,
    PROCESS_ORDERS, TRs, TOs,
    INBOUND, PO_RECEIPTS, STO_RECEIPTS,
    DELIVERIES,
    STORAGE_BINS, LINE_SIDE,
    DISP_TASKS, HUs,
    EXCEPTIONS, WORKLOAD, KPIs,
  };
export default WM;
