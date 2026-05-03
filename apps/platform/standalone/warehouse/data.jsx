/* Synthetic warehouse data for the prototype */

const DATA = (() => {
  const operators = [
    { id: 'op1', name: 'Aoife Brennan',    init: 'AB', queue: 'Q-WHB-01', shift: 'Day',   load: 0.72, status: 'busy', jobs: 4, dispensary: true },
    { id: 'op2', name: 'Marek Kowalski',   init: 'MK', queue: 'Q-WHA-02', shift: 'Day',   load: 0.41, status: 'free', jobs: 2, dispensary: false },
    { id: 'op3', name: 'Priya Subramanian',init: 'PS', queue: 'Q-DSP-01', shift: 'Day',   load: 0.88, status: 'busy', jobs: 6, dispensary: true },
    { id: 'op4', name: 'Tomás Walsh',      init: 'TW', queue: 'Q-WHB-01', shift: 'Day',   load: 0.22, status: 'free', jobs: 1, dispensary: false },
    { id: 'op5', name: 'Liang Chen',       init: 'LC', queue: 'Q-WHA-02', shift: 'Night', load: 0.0,  status: 'off',  jobs: 0, dispensary: false },
    { id: 'op6', name: 'Niamh O\'Connor',  init: 'NO', queue: 'Q-DSP-01', shift: 'Day',   load: 0.55, status: 'free', jobs: 3, dispensary: true },
    { id: 'op7', name: 'Sven Eriksen',     init: 'SE', queue: 'Q-WHA-02', shift: 'Day',   load: 0.65, status: 'busy', jobs: 5, dispensary: false },
    { id: 'op8', name: 'Hana Takeshi',     init: 'HT', queue: 'Q-DSP-01', shift: 'Day',   load: 0.0,  status: 'off',  jobs: 0, dispensary: true },
  ];

  // Process orders / staging demand for TR Creation
  const orders = [
    { po: '70044182', desc: 'Cheddar Crunch Topping 25kg',    psa: 'PSA-A12', line: 'L-Process 04', source: 'S', whse: 'B-21-04', priority: 'High',   reqDate: '2026-05-02', linesWM: 6,  linesDsp: 2,  pallets: 4, weight: 380, status: 'ready', material: '1050-C-CRN-25' },
    { po: '70044183', desc: 'Savoury Bouillon Base 1000kg',   psa: 'PSA-B07', line: 'L-Process 02', source: 'S', whse: 'A-04-12', priority: 'Medium', reqDate: '2026-05-02', linesWM: 12, linesDsp: 0,  pallets: 1, weight: 1000, status: 'ready', material: '2018-B-BOU-1T' },
    { po: '70044184', desc: 'Citrus Flavour Compound 50kg',   psa: 'PSA-C03', line: 'L-Process 01', source: 'D', whse: 'D-12-08', priority: 'High',   reqDate: '2026-05-02', linesWM: 0,  linesDsp: 4,  pallets: 1, weight: 50,   status: 'ready', material: '5012-D-CIT-50' },
    { po: '70044185', desc: 'Whey Protein Isolate WPI-90 25kg', psa: 'PSA-A12', line: 'L-Process 04', source: 'S', priority: 'Medium', reqDate: '2026-05-02', linesWM: 8,  linesDsp: 1,  pallets: 3, weight: 280, status: 'aged',  ageHours: 6, material: '4471-W-WPI-25', whse: 'B-22-01' },
    { po: '70044186', desc: 'Maltodextrin DE-19 25kg',        psa: 'PSA-B07', line: 'L-Process 02', source: 'S', whse: 'A-09-04', priority: 'Low',    reqDate: '2026-05-03', linesWM: 14, linesDsp: 0,  pallets: 6, weight: 600, status: 'ready', material: '3322-M-DE19' },
    { po: '70044187', desc: 'Yeast Extract Powder 10kg',      psa: 'PSA-C03', line: 'L-Process 01', source: 'D', whse: 'D-04-01', priority: 'High',   reqDate: '2026-05-02', linesWM: 0,  linesDsp: 6,  pallets: 1, weight: 60,   status: 'short', material: '6210-Y-EXT-10' },
    { po: '70044188', desc: 'Dairy Cream Flavour 200kg',      psa: 'PSA-A12', line: 'L-Process 04', source: 'S', whse: 'B-18-22', priority: 'Medium', reqDate: '2026-05-02', linesWM: 5,  linesDsp: 2,  pallets: 2, weight: 200, status: 'ready', material: '5430-D-CRM-200' },
    { po: '70044189', desc: 'Salt Microcrystal 25kg',         psa: 'PSA-B07', line: 'L-Process 02', source: 'S', whse: 'A-11-09', priority: 'Low',    reqDate: '2026-05-03', linesWM: 22, linesDsp: 0,  pallets: 8, weight: 200, status: 'ready', material: '1100-S-MCS-25' },
    { po: '70044190', desc: 'Onion Powder Roasted 20kg',      psa: 'PSA-C03', line: 'L-Process 03', source: 'D', whse: 'D-22-15', priority: 'Medium', reqDate: '2026-05-02', linesWM: 0,  linesDsp: 3,  pallets: 1, weight: 60,   status: 'ready', material: '7022-O-RST-20' },
    { po: '70044191', desc: 'Smoke Flavour Liquid 200kg',     psa: 'PSA-A12', line: 'L-Process 04', source: 'S', whse: 'B-30-02', priority: 'High',   reqDate: '2026-05-02', linesWM: 4,  linesDsp: 1,  pallets: 2, weight: 400, status: 'ready', material: '5440-S-SMK-200' },
    { po: '70044192', desc: 'Beef Stock Concentrate 25kg',    psa: 'PSA-B07', line: 'L-Process 02', source: 'S', whse: 'A-14-08', priority: 'Medium', reqDate: '2026-05-02', linesWM: 9,  linesDsp: 2,  pallets: 3, weight: 280, status: 'aged', ageHours: 4, material: '2030-B-BSC-25' },
    { po: '70044193', desc: 'Garlic Powder 10kg',             psa: 'PSA-C03', line: 'L-Process 01', source: 'D', whse: 'D-08-03', priority: 'Low',    reqDate: '2026-05-03', linesWM: 0,  linesDsp: 5,  pallets: 1, weight: 50,   status: 'ready', material: '7019-G-PWD-10' },
  ];

  // Created TRs for Job Assignment
  const trs = [
    { tr: '0010024187', type: 'BD', source: 'S', material: '1050-C-CRN-25', desc: 'Cheddar Crunch Topping 25kg', psa: 'PSA-A12', line: 'L-Process 04', srcBin: 'B-21-04', dstBin: 'STG-12', linesWM: 6, pickedWM: 0, linesDsp: 2, pickedDsp: 0, qty: 380, unit: 'KG', status: 'A', queue: 'Q-WHB-01', operator: null, age: 12, created: '07:42', priority: 'High',  shipment: 'SH-887701', stockOk: true },
    { tr: '0010024188', type: 'TR', source: 'D', material: '5012-D-CIT-50', desc: 'Citrus Flavour Compound 50kg', psa: 'PSA-C03', line: 'L-Process 01', srcBin: 'D-12-08', dstBin: 'STG-04', linesWM: 0, pickedWM: 0, linesDsp: 4, pickedDsp: 1, qty: 50, unit: 'KG', status: 'B', queue: 'Q-DSP-01', operator: 'op3', age: 22, created: '07:31', priority: 'High', shipment: 'SH-887702', stockOk: true },
    { tr: '0010024189', type: 'BD', source: 'S', material: '2018-B-BOU-1T', desc: 'Savoury Bouillon Base 1000kg', psa: 'PSA-B07', line: 'L-Process 02', srcBin: 'A-04-12', dstBin: 'STG-08', linesWM: 12, pickedWM: 4, linesDsp: 0, pickedDsp: 0, qty: 1000, unit: 'KG', status: 'B', queue: 'Q-WHA-02', operator: 'op2', age: 35, created: '07:18', priority: 'Medium', shipment: 'SH-887703', stockOk: true },
    { tr: '0010024190', type: 'DC', source: 'D', material: '6210-Y-EXT-10', desc: 'Yeast Extract Powder 10kg', psa: 'PSA-C03', line: 'L-Process 01', srcBin: 'D-04-01', dstBin: 'STG-04', linesWM: 0, pickedWM: 0, linesDsp: 6, pickedDsp: 0, qty: 60, unit: 'KG', status: 'A', queue: 'Q-DSP-01', operator: null, age: 8, created: '07:55', priority: 'High', shipment: 'SH-887704', stockOk: false, stockMsg: 'Only 42 KG available in D-04-01 (need 60)' },
    { tr: '0010024191', type: 'ST', source: 'S', material: '4471-W-WPI-25', desc: 'Whey Protein Isolate 25kg', psa: 'PSA-A12', line: 'L-Process 04', srcBin: 'B-22-01', dstBin: 'STG-12', linesWM: 8, pickedWM: 8, linesDsp: 1, pickedDsp: 1, qty: 280, unit: 'KG', status: 'C', queue: 'Q-WHB-01', operator: 'op1', age: 105, created: '06:00', priority: 'Medium', shipment: 'SH-887690', stockOk: true, completedAt: '08:14' },
    { tr: '0010024192', type: 'BD', source: 'S', material: '3322-M-DE19',   desc: 'Maltodextrin DE-19 25kg', psa: 'PSA-B07', line: 'L-Process 02', srcBin: 'A-09-04', dstBin: 'STG-08', linesWM: 14, pickedWM: 0, linesDsp: 0, pickedDsp: 0, qty: 600, unit: 'KG', status: 'A', queue: null, operator: null, age: 4, created: '07:58', priority: 'Low', shipment: 'SH-887705', stockOk: true, autoAssign: true },
    { tr: '0010024193', type: 'TR', source: 'D', material: '7022-O-RST-20', desc: 'Onion Powder Roasted 20kg', psa: 'PSA-C03', line: 'L-Process 03', srcBin: 'D-22-15', dstBin: 'STG-06', linesWM: 0, pickedWM: 0, linesDsp: 3, pickedDsp: 0, qty: 60, unit: 'KG', status: 'A', queue: 'Q-DSP-01', operator: null, age: 18, created: '07:44', priority: 'Medium', shipment: 'SH-887706', stockOk: true },
    { tr: '0010024194', type: 'BD', source: 'S', material: '5440-S-SMK-200', desc: 'Smoke Flavour Liquid 200kg', psa: 'PSA-A12', line: 'L-Process 04', srcBin: 'B-30-02', dstBin: 'STG-12', linesWM: 4, pickedWM: 2, linesDsp: 1, pickedDsp: 0, qty: 400, unit: 'KG', status: 'B', queue: 'Q-WHB-01', operator: 'op7', age: 28, created: '07:34', priority: 'High', shipment: 'SH-887707', stockOk: true },
    { tr: '0010024195', type: 'BD', source: 'S', material: '1100-S-MCS-25', desc: 'Salt Microcrystal 25kg', psa: 'PSA-B07', line: 'L-Process 02', srcBin: 'A-11-09', dstBin: 'STG-08', linesWM: 22, pickedWM: 0, linesDsp: 0, pickedDsp: 0, qty: 200, unit: 'KG', status: 'A', queue: 'Q-WHA-02', operator: null, age: 6, created: '07:56', priority: 'Low', shipment: 'SH-887708', stockOk: true, autoAssign: true },
  ];

  const queues = [
    { id: 'Q-WHA-02', name: 'Warehouse A · Bulk Drop', operators: 3, jobs: 7, color: 'slate' },
    { id: 'Q-WHB-01', name: 'Warehouse B · Bulk Drop', operators: 3, jobs: 5, color: 'sage' },
    { id: 'Q-DSP-01', name: 'Dispensary',              operators: 3, jobs: 9, color: 'sunset' },
  ];

  // Consolidated picking — same material across multiple TRs
  const consolidations = [
    { material: '4471-W-WPI-25', desc: 'Whey Protein Isolate WPI-90 25kg', psa: 'PSA-A12', supplyArea: 'Bulk Storage A', totalReq: 280, unit: 'KG', trs: ['0010024191','0010024197','0010024199'], satisfies: 3, savings: '34 min' },
    { material: '1100-S-MCS-25', desc: 'Salt Microcrystal 25kg', psa: 'PSA-B07', supplyArea: 'Bulk Storage B', totalReq: 600, unit: 'KG', trs: ['0010024195','0010024196','0010024198','0010024200'], satisfies: 4, savings: '52 min' },
    { material: '3322-M-DE19',   desc: 'Maltodextrin DE-19 25kg', psa: 'PSA-B07', supplyArea: 'Bulk Storage B', totalReq: 1200, unit: 'KG', trs: ['0010024192','0010024201'], satisfies: 2, savings: '21 min' },
  ];

  // Audit log
  const auditLog = [
    { ts: '08:14:23', who: 'a.chen',   action: 'completed', target: 'TR 0010024191', details: 'Whey Protein Isolate · 8/8 lines · Aoife Brennan', icon: 'check' },
    { ts: '08:12:08', who: 'system',   action: 'auto-assigned', target: 'TR 0010024195', details: 'RF login by Sven Eriksen → Q-WHA-02', icon: 'rf' },
    { ts: '08:09:51', who: 'm.dunne',  action: 'created', target: '4 TRs (Bulk Drop)', details: 'Process orders 70044182, 70044188, 70044191, 70044194', icon: 'plus' },
    { ts: '08:09:51', who: 'system',   action: 'warning', target: 'TR 0010024190', details: 'Stock check: only 42 KG of 6210-Y-EXT-10 available in D-04-01 (need 60)', icon: 'warn' },
    { ts: '08:07:14', who: 'm.dunne',  action: 'assigned', target: 'TR 0010024188', details: '→ Priya Subramanian (Q-DSP-01)', icon: 'user' },
    { ts: '08:05:02', who: 'm.dunne',  action: 'consolidated', target: '4 TRs → 1 pick', details: 'Salt Microcrystal · 600 KG · 52 min saved', icon: 'merge' },
    { ts: '08:01:30', who: 'm.dunne',  action: 'created', target: '2 TRs (Dispensary)', details: 'Process orders 70044184, 70044187', icon: 'plus' },
    { ts: '07:59:11', who: 'system',   action: 'error', target: 'PO 70044187', details: 'Stock shortage: 6210-Y-EXT-10 — TR not created', icon: 'x' },
    { ts: '07:42:00', who: 'm.dunne',  action: 'opened', target: 'Plant 1101 / WH 200', details: 'Resumed from "My Warehouse" view', icon: 'in' },
  ];

  return { operators, orders, trs, queues, consolidations, auditLog };
})();

window.DATA = DATA;
