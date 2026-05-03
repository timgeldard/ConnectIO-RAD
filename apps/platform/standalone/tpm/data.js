/* TPM Cockpit — mock data + small helpers
   All data lives on window.TPM so any component file can read it.
*/

const TPM = (() => {
  const fmtN = (n) => new Intl.NumberFormat('en-US').format(n);
  const fmtKg = (n) => fmtN(Math.round(n)) + ' kg';
  const fmtT  = (n) => (n/1000).toFixed(1) + ' t';
  const fmtCur = (n) => '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

  // Plants
  const plants = {
    K100: { code: 'K100', name: 'Kerry Bristol UK',     country: 'GB', kind: 'src' },
    K140: { code: 'K140', name: 'Kerry Beloit US',      country: 'US', kind: 'src' },
    K220: { code: 'K220', name: 'Kerry Granada ES',     country: 'ES', kind: 'src' },
    K310: { code: 'K310', name: 'Kerry Charlotte US',   country: 'US', kind: 'dst' },
    K330: { code: 'K330', name: 'Kerry Naas IE',        country: 'IE', kind: 'dst' },
    T801: { code: 'T801', name: 'Vendor — Coppini IT',  country: 'IT', kind: 'tpm' },
    T802: { code: 'T802', name: 'Vendor — Aalborg DK',  country: 'DK', kind: 'tpm' },
    T803: { code: 'T803', name: 'Vendor — Saraburi TH', country: 'TH', kind: 'tpm' },
    T804: { code: 'T804', name: 'Vendor — Querétaro MX',country: 'MX', kind: 'tpm' },
    T805: { code: 'T805', name: 'Vendor — Lyon FR',     country: 'FR', kind: 'tpm' },
  };

  // Materials
  const materials = [
    { code: '54-KE-77231', desc: 'Tastesense™ Sweet Beverage Premix',     uom: 'kg', family: 'Taste — Beverage' },
    { code: '54-KE-77410', desc: 'Probiotic Powder Blend GanedenBC30',     uom: 'kg', family: 'Proactive Health' },
    { code: '54-KE-77508', desc: 'Savoury Reaction Flavour 12%',           uom: 'kg', family: 'Taste — Savoury' },
    { code: '54-KE-77621', desc: 'Plant Protein Hydrolysate ProDiem™',     uom: 'kg', family: 'Proactive Health' },
    { code: '54-KE-77834', desc: 'Sodium Reduction System SaltLine 4',     uom: 'kg', family: 'Taste — Savoury' },
    { code: '54-KE-77902', desc: 'Citrus Top-Note Distillate Oranji 7',    uom: 'kg', family: 'Taste — Beverage' },
    { code: '54-KE-78015', desc: 'Bouillon Concentrate, Reduced Salt',     uom: 'kg', family: 'Foodservice' },
  ];

  // Lifecycle stages, in order
  const stages = [
    { id: 'sto',     short: 'STO',          name: 'STO Created',         desc: 'Stock transfer order opened from source plant' },
    { id: 'transit', short: 'In Transit',   name: 'In Transit',           desc: 'Inventory moving from source to TPM' },
    { id: 'tpmInv',  short: 'TPM Inventory',name: 'At TPM Plant',         desc: 'Received and held at toll-manufacturing plant' },
    { id: 'wip',     short: 'In Process',   name: 'Toll WIP',             desc: 'Subcontracting / processing in progress at TPM' },
    { id: 'awaitRet',short: 'Awaiting Return',name: 'Finished — Awaiting Return', desc: 'Finished goods waiting to ship back from TPM' },
    { id: 'returnTransit', short: 'Return Transit', name: 'Return Transit', desc: 'In transit from TPM back to a Kerry plant' },
    { id: 'fulfil',  short: 'Fulfilment',   name: 'Onward Fulfilment',    desc: 'Interplant or customer shipment after return' },
  ];

  // KPI strip for the control tower
  const overviewKpis = [
    { id: 'stockTpm',    label: 'Stock at TPM',          value: 1842,  unit: 't',  trend: -2.1, status: 'info',     spark: [120,140,170,180,165,170,158,150,148,144,142,142] },
    { id: 'inTransit',   label: 'In Transit (STO)',      value: 412,   unit: 't',  trend: +5.4, status: 'info',     spark: [80,82,90,95,99,108,121,118,124,131,138,141] },
    { id: 'inProcess',   label: 'In Process (WIP)',      value: 624,   unit: 't',  trend: -0.8, status: 'info',     spark: [70,75,73,77,82,80,84,88,90,86,84,80] },
    { id: 'awaitReturn', label: 'Awaiting Return',       value: 318,   unit: 't',  trend: +12.3,status: 'pending',  spark: [22,25,30,32,35,40,46,52,58,60,62,64] },
    { id: 'delayedRet',  label: 'Delayed Returns',       value: 47,    unit: 'lots',trend: +18.2,status: 'risk',    spark: [12,14,18,22,28,30,32,38,40,42,44,47] },
    { id: 'custRisk',    label: 'At-Risk Customer Cmts', value: 12,    unit: '',    trend: +3,   status: 'risk',    spark: [4,5,4,6,7,9,8,10,11,11,12,12] },
    { id: 'reconIssues', label: 'Reconciliation Issues', value: 23,    unit: '',    trend: -4,   status: 'pending', spark: [40,38,33,30,28,28,26,25,25,24,24,23] },
    { id: 'avgTat',      label: 'Avg Toll Turnaround',   value: 18.4,  unit: 'd',   trend: +1.2, status: 'pending', spark: [15,15.5,16,16.4,17,17.2,17.8,18,18.1,18.3,18.4,18.4] },
  ];

  // End-to-end lifecycle volume (tonnes) for funnel
  const lifecycleFunnel = [
    { stage: 'sto',          label: 'STO Created',        value: 412,  count: 86,  status: 'ok',      delay: 0  },
    { stage: 'transit',      label: 'In Transit',          value: 358,  count: 71,  status: 'ok',      delay: 4  },
    { stage: 'tpmInv',       label: 'At TPM Plant',        value: 1842, count: 312, status: 'ok',      delay: 0  },
    { stage: 'wip',          label: 'In Process',          value: 624,  count: 124, status: 'pending', delay: 6  },
    { stage: 'awaitRet',     label: 'Awaiting Return',     value: 318,  count: 79,  status: 'pending', delay: 11 },
    { stage: 'returnTransit',label: 'Return Transit',      value: 142,  count: 38,  status: 'risk',    delay: 18 },
    { stage: 'fulfil',       label: 'Onward Fulfilment',   value: 96,   count: 41,  status: 'ok',      delay: 2  },
  ];

  // Aging buckets per stage (tonnes)
  const agingByStage = [
    { stage: 'In Transit',     b: [220, 88,  35,  15] },
    { stage: 'TPM Inventory',  b: [820, 540, 320, 162] },
    { stage: 'In Process',     b: [310, 180, 96,  38] },
    { stage: 'Awaiting Return',b: [110, 84,  72,  52] },
    { stage: 'Return Transit', b: [42,  38,  30,  32] },
  ];

  // Top TPM vendors
  const topVendors = [
    { plant: 'T801', name: 'Coppini IT',     volume: 612, delay: 8.4,  delayed: 6,  exceptions: 12, trendDir: 'up' },
    { plant: 'T802', name: 'Aalborg DK',     volume: 488, delay: 4.1,  delayed: 2,  exceptions: 4,  trendDir: 'flat' },
    { plant: 'T803', name: 'Saraburi TH',    volume: 410, delay: 14.2, delayed: 11, exceptions: 18, trendDir: 'up' },
    { plant: 'T804', name: 'Querétaro MX',   volume: 332, delay: 6.0,  delayed: 4,  exceptions: 7,  trendDir: 'down' },
    { plant: 'T805', name: 'Lyon FR',        volume: 280, delay: 3.2,  delayed: 1,  exceptions: 2,  trendDir: 'down' },
  ];

  // Recent critical transactions
  const recentTx = [
    { ts: '11:42', type: 'Return overdue',   doc: 'GR 5102844881', mat: '54-KE-77508', plant: 'T803', qty: '12,450 kg', sev: 'p1' },
    { ts: '11:18', type: 'Yield variance',   doc: 'PO 4500218714', mat: '54-KE-77621', plant: 'T801', qty: '−4.8%',     sev: 'p2' },
    { ts: '10:54', type: 'STO delayed',      doc: 'STO 4400188212', mat: '54-KE-77231', plant: 'K100→T801', qty: '8,200 kg', sev: 'p2' },
    { ts: '10:31', type: 'Batch link missing', doc: 'BATCH 0042-9921', mat: '54-KE-77410', plant: 'T802', qty: '2,100 kg', sev: 'p2' },
    { ts: '09:58', type: 'Customer at risk', doc: 'SO 7700981221', mat: '54-KE-77834', plant: 'K310', qty: 'PepsiCo NA',  sev: 'p1' },
    { ts: '09:14', type: 'Quality block',    doc: 'INSP 800124881', mat: '54-KE-77902', plant: 'T805', qty: '3,400 kg', sev: 'p2' },
    { ts: '08:46', type: 'Return received',  doc: 'GR 5102844710', mat: '54-KE-78015', plant: 'T804→K310', qty: '6,000 kg', sev: 'p3' },
  ];

  // Alerts strip
  const alerts = [
    { kind: 'risk',    ttl: '11 STOs to Saraburi (T803) overdue >5 days', body: '4,820 kg · linked to 3 at-risk customer commitments',  cta: 'Open exceptions' },
    { kind: 'pending', ttl: 'Aging WIP at Coppini (T801) trending up',    body: '46 lots > 14 days · yield variance −3.2% wk-over-wk',   cta: 'Inspect process' },
    { kind: 'info',    ttl: 'Databricks Gold refresh — 09:42 UTC',         body: 'TPM_LIFECYCLE_V3 incremental complete · 0 row warnings', cta: 'View lineage' },
  ];

  // STO list
  const stoList = [
    { id: 'STO-4400188212', src: 'K100', tpm: 'T801', mat: '54-KE-77231', desc: 'Tastesense Sweet Premix',  ordered: 8200,  shipped: 8200,  received: 0,    eta: '2026-04-29', status: 'risk',    age: 7,  delayD: 4,  doc: 'PGI 8000241' },
    { id: 'STO-4400188301', src: 'K140', tpm: 'T804', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',    ordered: 12400, shipped: 12400, received: 12400,eta: '2026-04-22', status: 'ok',      age: 12, delayD: 0,  doc: 'PGI 8000247' },
    { id: 'STO-4400188344', src: 'K220', tpm: 'T805', mat: '54-KE-77902', desc: 'Citrus Top-Note Distillate',ordered:3400,  shipped: 3400,  received: 0,    eta: '2026-05-04', status: 'pending', age: 3,  delayD: 1,  doc: 'PGI 8000252' },
    { id: 'STO-4400188388', src: 'K100', tpm: 'T802', mat: '54-KE-77410', desc: 'Probiotic Blend',           ordered: 2100,  shipped: 2100,  received: 2100, eta: '2026-04-25', status: 'ok',      age: 8,  delayD: 0,  doc: 'PGI 8000260' },
    { id: 'STO-4400188412', src: 'K140', tpm: 'T803', mat: '54-KE-77508', desc: 'Savoury Reaction Flavour',  ordered: 12450, shipped: 12450, received: 0,    eta: '2026-04-26', status: 'risk',    age: 9,  delayD: 6,  doc: 'PGI 8000266' },
    { id: 'STO-4400188440', src: 'K220', tpm: 'T801', mat: '54-KE-77834', desc: 'SaltLine 4 Reducer',        ordered: 6800,  shipped: 4200,  received: 0,    eta: '2026-05-02', status: 'pending', age: 2,  delayD: 0,  doc: 'PGI 8000269' },
    { id: 'STO-4400188475', src: 'K100', tpm: 'T805', mat: '54-KE-78015', desc: 'Bouillon Concentrate',      ordered: 5400,  shipped: 5400,  received: 5400, eta: '2026-04-21', status: 'ok',      age: 14, delayD: 0,  doc: 'PGI 8000271' },
    { id: 'STO-4400188503', src: 'K140', tpm: 'T801', mat: '54-KE-77508', desc: 'Savoury Reaction Flavour',  ordered: 4200,  shipped: 0,     received: 0,    eta: '2026-05-06', status: 'pending', age: 1,  delayD: 0,  doc: '—' },
    { id: 'STO-4400188527', src: 'K220', tpm: 'T803', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',     ordered: 9200,  shipped: 9200,  received: 0,    eta: '2026-04-28', status: 'risk',    age: 8,  delayD: 5,  doc: 'PGI 8000277' },
    { id: 'STO-4400188551', src: 'K100', tpm: 'T802', mat: '54-KE-77231', desc: 'Tastesense Sweet Premix',   ordered: 3600,  shipped: 3600,  received: 3600, eta: '2026-04-23', status: 'ok',      age: 10, delayD: 0,  doc: 'PGI 8000280' },
  ];

  // TPM plant inventory
  const tpmInv = [
    { plant: 'T801', mat: '54-KE-77231', desc: 'Tastesense Sweet Premix',   batch: 'B-2604-A', kind: 'raw',     qty: 6200, age: 14, dest: 'K310', next: 'Process · 2026-05-04', status: 'ok' },
    { plant: 'T801', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',      batch: 'B-2522-C', kind: 'wip',     qty: 4180, age: 22, dest: 'K330', next: 'Process · 2026-05-02', status: 'pending' },
    { plant: 'T801', mat: '54-KE-77834', desc: 'SaltLine 4 Reducer',         batch: 'B-2519-A', kind: 'wip',     qty: 1480, age: 31, dest: 'K310', next: 'Yield review',          status: 'risk' },
    { plant: 'T802', mat: '54-KE-77410', desc: 'Probiotic Blend',            batch: 'B-2607-B', kind: 'finished',qty: 2100, age: 6,  dest: 'K330', next: 'Return · 2026-05-03',  status: 'ok' },
    { plant: 'T802', mat: '54-KE-78015', desc: 'Bouillon Concentrate',       batch: 'B-2533-A', kind: 'blocked', qty: 720,  age: 19, dest: 'K310', next: 'QA hold',               status: 'risk' },
    { plant: 'T803', mat: '54-KE-77508', desc: 'Savoury Reaction Flavour',   batch: 'B-2510-D', kind: 'finished',qty: 12450,age: 28, dest: 'K310', next: 'Return overdue',        status: 'risk' },
    { plant: 'T803', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',      batch: 'B-2614-A', kind: 'raw',     qty: 9200, age: 4,  dest: 'K310', next: 'Process · 2026-05-06', status: 'ok' },
    { plant: 'T804', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',      batch: 'B-2604-F', kind: 'finished',qty: 6400, age: 5,  dest: 'K310', next: 'Return · 2026-05-02', status: 'ok' },
    { plant: 'T805', mat: '54-KE-77902', desc: 'Citrus Top-Note Distillate', batch: 'B-2620-A', kind: 'wip',     qty: 1820, age: 9,  dest: 'K330', next: 'Process · 2026-05-04', status: 'pending' },
    { plant: 'T805', mat: '54-KE-78015', desc: 'Bouillon Concentrate',       batch: 'B-2520-A', kind: 'raw',     qty: 5400, age: 18, dest: 'K330', next: 'Process · 2026-05-01', status: 'pending' },
  ];

  // Toll process queue
  const processQueue = [
    { id: 'PRC-088121', plant: 'T801', mat: '54-KE-77621', desc: 'Plant Protein ProDiem', step: 'Hydrolysis',   qtyIn: 8200, qtyOut: 7820, yieldPct: 95.4, varPct: -0.6, started: '2026-04-22', tat: 8,  expTat: 7,  status: 'pending' },
    { id: 'PRC-088145', plant: 'T801', mat: '54-KE-77834', desc: 'SaltLine 4 Reducer',     step: 'Granulation',  qtyIn: 1600, qtyOut: 1480, yieldPct: 92.5, varPct: -4.8, started: '2026-04-12', tat: 18, expTat: 12, status: 'risk' },
    { id: 'PRC-088203', plant: 'T802', mat: '54-KE-77410', desc: 'Probiotic Blend',         step: 'Microencap.',  qtyIn: 2200, qtyOut: 2100, yieldPct: 95.4, varPct: -0.6, started: '2026-04-26', tat: 4,  expTat: 5,  status: 'ok' },
    { id: 'PRC-088240', plant: 'T803', mat: '54-KE-77508', desc: 'Savoury Reaction Flavour',step: 'Reaction',     qtyIn: 13200,qtyOut: null, yieldPct: null, varPct: null, started: '2026-04-14', tat: 16, expTat: 10, status: 'risk' },
    { id: 'PRC-088277', plant: 'T804', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',   step: 'Hydrolysis',   qtyIn: 6800, qtyOut: 6400, yieldPct: 94.1, varPct: -1.9, started: '2026-04-25', tat: 5,  expTat: 7,  status: 'ok' },
    { id: 'PRC-088311', plant: 'T805', mat: '54-KE-77902', desc: 'Citrus Top-Note Distillate',step:'Distillation',qtyIn: 2000, qtyOut: 1820, yieldPct: 91.0, varPct: -3.0, started: '2026-04-23', tat: 7,  expTat: 6,  status: 'pending' },
    { id: 'PRC-088340', plant: 'T805', mat: '54-KE-78015', desc: 'Bouillon Concentrate',     step: 'Concentr.',    qtyIn: 5400, qtyOut: null, yieldPct: null, varPct: null, started: null,        tat: 0,  expTat: 6,  status: 'pending' },
  ];

  // Returns / receipts
  const returns = [
    { id: 'GR-5102844881', tpm: 'T803', dst: 'K310', mat: '54-KE-77508', desc: 'Savoury Reaction Flavour',  expQty: 12450, recQty: null,  diff: null, status: 'risk',    eta: '2026-04-26', daysLate: 6, batch: 'B-2510-D', exception: 'Overdue' },
    { id: 'GR-5102844710', tpm: 'T804', dst: 'K310', mat: '54-KE-78015', desc: 'Bouillon Concentrate',      expQty: 6000,  recQty: 6000,  diff: 0,    status: 'ok',      eta: '2026-04-26', daysLate: 0, batch: 'B-2520-A', exception: '' },
    { id: 'GR-5102844892', tpm: 'T801', dst: 'K330', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',     expQty: 7820,  recQty: 7740,  diff: -80,  status: 'pending', eta: '2026-04-28', daysLate: 0, batch: 'B-2522-C', exception: 'Qty short' },
    { id: 'GR-5102844915', tpm: 'T802', dst: 'K330', mat: '54-KE-77410', desc: 'Probiotic Blend',           expQty: 2100,  recQty: 2100,  diff: 0,    status: 'ok',      eta: '2026-05-03', daysLate: 0, batch: 'B-2607-B', exception: '' },
    { id: 'GR-5102844931', tpm: 'T805', dst: 'K330', mat: '54-KE-77902', desc: 'Citrus Top-Note Distillate',expQty: 1820,  recQty: 1820,  diff: 0,    status: 'ok',      eta: '2026-05-04', daysLate: 0, batch: 'B-2620-A', exception: '' },
    { id: 'GR-5102844946', tpm: 'T801', dst: 'K310', mat: '54-KE-77834', desc: 'SaltLine 4 Reducer',        expQty: 1600,  recQty: 1480,  diff: -120, status: 'risk',    eta: '2026-04-24', daysLate: 7, batch: 'B-2519-A', exception: 'Yield -4.8%' },
    { id: 'GR-5102844977', tpm: 'T803', dst: 'K310', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',     expQty: 9200,  recQty: null,  diff: null, status: 'pending', eta: '2026-05-08', daysLate: 0, batch: 'B-2614-A', exception: '' },
  ];

  // Fulfilment after return
  const fulfilment = [
    { id: 'SO-7700981221', cust: 'PepsiCo NA',         dst: 'K310', via: 'T803', mat: '54-KE-77508', desc: 'Savoury Reaction Flavour',  qty: 12450, due: '2026-05-08', status: 'risk',    risk: 'Service risk · GR overdue 6d', batch: 'B-2510-D', kind: 'customer' },
    { id: 'SO-7700981304', cust: 'Nestlé EMEA',        dst: 'K330', via: 'T801', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',     qty: 7740,  due: '2026-05-06', status: 'pending', risk: 'Qty short −80 kg',           batch: 'B-2522-C', kind: 'customer' },
    { id: 'STO-4500119812',cust: 'Interplant K310→K140',dst: 'K140',via: 'T804', mat: '54-KE-77621', desc: 'Plant Protein ProDiem',     qty: 6000,  due: '2026-05-04', status: 'ok',      risk: '',                          batch: 'B-2604-F', kind: 'interplant' },
    { id: 'SO-7700981358', cust: 'Danone APAC',        dst: 'K330', via: 'T802', mat: '54-KE-77410', desc: 'Probiotic Blend',           qty: 2100,  due: '2026-05-12', status: 'ok',      risk: '',                          batch: 'B-2607-B', kind: 'customer' },
    { id: 'SO-7700981392', cust: 'Mondelēz NA',        dst: 'K310', via: 'T805', mat: '54-KE-77902', desc: 'Citrus Top-Note Distillate',qty: 1820,  due: '2026-05-10', status: 'pending', risk: 'On hold pending QA',        batch: 'B-2620-A', kind: 'customer' },
    { id: 'STO-4500119830',cust: 'Interplant K310→K330',dst:'K330', via: 'T801', mat: '54-KE-77834', desc: 'SaltLine 4 Reducer',         qty: 1480,  due: '2026-05-09', status: 'risk',    risk: 'Yield variance −4.8%',      batch: 'B-2519-A', kind: 'interplant' },
  ];

  // Traceability — selected lot trace
  const traceLot = {
    lot: 'B-2510-D',
    material: '54-KE-77508',
    desc: 'Savoury Reaction Flavour 12%',
    chain: [
      { id: 'STO-4400188412', stage: 'sto',     ttl: 'STO Created',     plant: 'K140', meta: 'STO 4400188412 · 2026-04-12 · 13,200 kg',  qty: 13200, status: 'ok' },
      { id: 'PGI 8000266',    stage: 'transit', ttl: 'Goods Issue (Source)', plant: 'K140', meta: 'PGI 8000266 · 2026-04-13', qty: 13200, status: 'ok' },
      { id: 'GR 5101204881',  stage: 'tpmInv',  ttl: 'GR @ TPM Plant',  plant: 'T803', meta: 'GR 5101204881 · 2026-04-15', qty: 13200, status: 'ok' },
      { id: 'PRC-088240',     stage: 'wip',     ttl: 'Process Started · Reaction', plant: 'T803', meta: 'PRC-088240 · 2026-04-14', qty: 13200, status: 'warn' },
      { id: 'PRC-088240-OUT', stage: 'awaitRet',ttl: 'Finished — Awaiting Return', plant: 'T803', meta: 'Yield 94.3% · 12,450 kg', qty: 12450, status: 'warn' },
      { id: 'GR-5102844881',  stage: 'returnTransit', ttl: 'Return GR (overdue)', plant: 'T803 → K310', meta: 'Expected 2026-04-26 · 6 days late', qty: null, status: 'risk' },
      { id: 'SO-7700981221',  stage: 'fulfil',  ttl: 'Customer Order — PepsiCo NA', plant: 'K310', meta: 'Due 2026-05-08 · service risk', qty: 12450, status: 'pending' },
    ],
    recon: { source: 13200, transit: 13200, tpmIn: 13200, processIn: 13200, processOut: 12450, returnExp: 12450, returnRcv: 0, fulfil: 12450 },
    batches: [
      { from: 'B-K140-77508-A019', to: 'B-2510-D', qty: 13200, type: 'split' },
      { from: 'B-2510-D', to: '—',       qty: null,  type: 'pending return' },
    ],
  };

  // Exceptions queue
  const exceptions = [
    { id: 'EX-2604-001', sev: 'p1', kind: 'Return overdue',       owner: 'M. Lynch',     plant: 'T803', mat: '54-KE-77508', age: 6, qty: '12,450 kg', linked: 'SO-7700981221 · PepsiCo NA',     status: 'open' },
    { id: 'EX-2604-002', sev: 'p1', kind: 'Customer order at risk',owner: 'A. Costa',     plant: 'K310', mat: '54-KE-77508', age: 2, qty: 'PepsiCo NA',  linked: 'GR-5102844881',                  status: 'open' },
    { id: 'EX-2604-003', sev: 'p2', kind: 'Yield variance',        owner: 'R. Chen',      plant: 'T801', mat: '54-KE-77834', age: 4, qty: '−4.8%',     linked: 'PRC-088145',                     status: 'open' },
    { id: 'EX-2604-004', sev: 'p2', kind: 'STO delayed (in transit)',owner: 'P. Singh',   plant: 'T803', mat: '54-KE-77508', age: 6, qty: '12,450 kg', linked: 'STO-4400188412',                 status: 'open' },
    { id: 'EX-2604-005', sev: 'p2', kind: 'Aged TPM inventory',    owner: 'M. Lynch',     plant: 'T801', mat: '54-KE-77834', age: 31,qty: '1,480 kg',  linked: 'B-2519-A',                       status: 'investigating' },
    { id: 'EX-2604-006', sev: 'p2', kind: 'Process not started',   owner: 'R. Chen',      plant: 'T805', mat: '54-KE-78015', age: 5, qty: '5,400 kg',  linked: 'PRC-088340',                     status: 'open' },
    { id: 'EX-2604-007', sev: 'p2', kind: 'Missing batch link',    owner: 'L. O\u2019Hara',plant: 'T802', mat: '54-KE-77410', age: 1, qty: '2,100 kg',  linked: 'BATCH 0042-9921',                status: 'open' },
    { id: 'EX-2604-008', sev: 'p2', kind: 'Quality block at TPM',  owner: 'L. O\u2019Hara',plant: 'T802', mat: '54-KE-78015', age: 3, qty: '720 kg',    linked: 'INSP 800124881',                 status: 'open' },
    { id: 'EX-2604-009', sev: 'p3', kind: 'Quantity short on return',owner: 'A. Costa',   plant: 'T801', mat: '54-KE-77621', age: 1, qty: '−80 kg',    linked: 'GR-5102844892',                  status: 'open' },
    { id: 'EX-2604-010', sev: 'p3', kind: 'Stock blocked at return plant',owner: 'A. Costa',plant: 'K310',mat: '54-KE-77902', age: 2, qty: '420 kg',    linked: 'B-2620-A',                       status: 'open' },
  ];

  // Saved views
  const savedViews = [
    { name: 'My EMEA TPM',          owner: 'me' },
    { name: 'Saraburi watchlist',   owner: 'me' },
    { name: 'PepsiCo orders',       owner: 'me' },
    { name: 'Salt-reduction WIP',   owner: 'shared' },
  ];

  return {
    plants, materials, stages, overviewKpis, lifecycleFunnel, agingByStage,
    topVendors, recentTx, alerts, stoList, tpmInv, processQueue, returns,
    fulfilment, traceLot, exceptions, savedViews,
    fmtN, fmtKg, fmtT, fmtCur,
  };
})();

window.TPM = TPM;
