// data.jsx — Realistic SAP-shaped mock data for Inventory Cockpit
// Plants, materials, batches, bins, IM/WM stock, movements, exceptions.

const PLANTS = [
  { code: "1000", name: "Naas — Ireland",          country: "IE", warehouses: ["NS01", "NS02"] },
  { code: "2000", name: "Beloit — USA",            country: "US", warehouses: ["BL01"] },
  { code: "3000", name: "Rotterdam — Netherlands", country: "NL", warehouses: ["RT01", "RT02"] },
  { code: "4000", name: "Johor — Malaysia",        country: "MY", warehouses: ["JH01"] },
  { code: "5000", name: "Jaboticabal — Brazil",    country: "BR", warehouses: ["JB01"] },
];

const MATERIAL_TYPES = ["FERT", "HALB", "ROH", "VERP"];
const STORAGE_LOCS = ["0001", "0002", "0003", "QM01", "BL01", "INTR"];
const STORAGE_LOC_NAMES = {
  "0001": "Main raw mat.",
  "0002": "Packaging",
  "0003": "Finished goods",
  "QM01": "Quality inspection",
  "BL01": "Blocked stock",
  "INTR": "Interim / in-transit",
};

const STOCK_TYPES = [
  { key: "unrestricted", label: "Unrestricted", color: "var(--c-success)" },
  { key: "qi",           label: "QI",           color: "var(--c-info)" },
  { key: "blocked",      label: "Blocked",      color: "var(--c-danger)" },
  { key: "restricted",   label: "Restricted",   color: "var(--c-warning)" },
  { key: "interim",      label: "Interim",      color: "var(--c-purple)" },
];

const MATERIALS = [
  { code: "100-2034", desc: "Whey Protein Isolate 90% Instantized", type: "HALB", uom: "KG",  abc: "A", xyz: "X" },
  { code: "100-2891", desc: "Sodium Caseinate Spray-Dried",          type: "HALB", uom: "KG",  abc: "A", xyz: "Y" },
  { code: "200-4412", desc: "Beef Bouillon Concentrate Type-3",       type: "FERT", uom: "KG",  abc: "B", xyz: "X" },
  { code: "200-4419", desc: "Vegetable Stock Powder Low-Sodium",      type: "FERT", uom: "KG",  abc: "A", xyz: "X" },
  { code: "300-1108", desc: "Lactose Monohydrate USP Pharma Grade",   type: "ROH",  uom: "KG",  abc: "A", xyz: "X" },
  { code: "300-1112", desc: "Maltodextrin DE-19",                     type: "ROH",  uom: "KG",  abc: "B", xyz: "Y" },
  { code: "400-7701", desc: "Yeast Extract — Savoury Profile YE-12",  type: "HALB", uom: "KG",  abc: "B", xyz: "X" },
  { code: "400-7732", desc: "Natural Flavour — Roasted Onion N-220",  type: "HALB", uom: "KG",  abc: "C", xyz: "Z" },
  { code: "500-3301", desc: "Lipid Encapsulate Omega-3 LipidShield",  type: "HALB", uom: "KG",  abc: "A", xyz: "Y" },
  { code: "500-3318", desc: "Probiotic Blend HOWARU® Premium",        type: "FERT", uom: "KG",  abc: "A", xyz: "Z" },
  { code: "600-9120", desc: "Citric Acid Anhydrous Fine Granular",    type: "ROH",  uom: "KG",  abc: "C", xyz: "X" },
  { code: "600-9135", desc: "Sodium Chloride PDV Food Grade",         type: "ROH",  uom: "KG",  abc: "C", xyz: "X" },
  { code: "700-5501", desc: "Carton 6×1.5kg Whey Iso. Brand-Pack",    type: "VERP", uom: "EA",  abc: "B", xyz: "X" },
  { code: "700-5519", desc: "Foil Liner 380×280 Heat-Seal",           type: "VERP", uom: "EA",  abc: "C", xyz: "Y" },
  { code: "800-2204", desc: "Vanilla Extract Madagascar Bourbon",     type: "ROH",  uom: "L",   abc: "B", xyz: "Z" },
  { code: "800-2240", desc: "Cocoa Powder Natural 10/12 Alkalized",   type: "ROH",  uom: "KG",  abc: "B", xyz: "Y" },
];

// deterministic pseudo-random
function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function fmt(n) { return n.toLocaleString("en-US"); }

// Build an inventory dataset (IM rows × plants × storage locs × stock types)
function buildInventoryRows(scenario) {
  const r = rng(scenario === "outage" ? 99 : scenario === "warning" ? 42 : 7);
  const rows = [];
  let id = 1;
  for (const m of MATERIALS) {
    for (const p of PLANTS) {
      // each material lives in 1-3 storage locs per plant
      const locCount = 1 + Math.floor(r() * 3);
      const locs = [...STORAGE_LOCS].sort(() => r() - .5).slice(0, locCount);
      for (const sl of locs) {
        const base = Math.floor(2000 + r() * 18000);
        const unrestricted = sl === "BL01" ? 0 : sl === "QM01" ? 0 : Math.floor(base * (0.7 + r() * 0.25));
        const qi          = sl === "QM01" ? Math.floor(base * 0.9) : Math.floor(r() * 200);
        const blocked     = sl === "BL01" ? Math.floor(base * 0.8) : Math.floor(r() * 60);
        const restricted  = Math.floor(r() * 80);
        const interim     = sl === "INTR" ? Math.floor(base * 0.6) : Math.floor(r() * 40);
        const im_total = unrestricted + qi + blocked + restricted + interim;
        // WM mirror — usually matches, sometimes drifts
        const drift = r();
        let wm_total = im_total;
        let mismatch_kind = "match";
        let mismatch_age_h = 0;
        if (drift < 0.06) { wm_total = im_total - Math.floor(im_total * (0.02 + r() * 0.08)); mismatch_kind = "true"; mismatch_age_h = Math.floor(8 + r() * 96); }
        else if (drift < 0.14) { wm_total = im_total + Math.floor(50 + r() * 220); mismatch_kind = "timing"; mismatch_age_h = Math.floor(1 + r() * 6); }
        else if (drift < 0.18) { wm_total = im_total - Math.floor(20 + r() * 100); mismatch_kind = "interim"; mismatch_age_h = Math.floor(2 + r() * 12); }

        rows.push({
          id: id++,
          material: m.code, desc: m.desc, mtype: m.type, uom: m.uom, abc: m.abc, xyz: m.xyz,
          plant: p.code, plantName: p.name,
          storageLoc: sl, storageLocName: STORAGE_LOC_NAMES[sl],
          unrestricted, qi, blocked, restricted, interim,
          im_total, wm_total,
          delta: wm_total - im_total,
          mismatch_kind, mismatch_age_h,
          value_eur: Math.floor(im_total * (1.2 + r() * 6)),
          batches: 1 + Math.floor(r() * 4),
        });
      }
    }
  }
  return rows;
}

function buildBatches(materialCode) {
  const r = rng(materialCode.charCodeAt(4) * 7);
  const out = [];
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const expDays = Math.floor(-30 + r() * 540);
    const qty = Math.floor(200 + r() * 4200);
    out.push({
      batch: `B${(2025).toString()}${String(100 + Math.floor(r()*900)).padStart(3,"0")}-${i+1}`,
      qty,
      expDays,
      created: `2026-${String(1 + Math.floor(r()*4)).padStart(2,"0")}-${String(1 + Math.floor(r()*28)).padStart(2,"0")}`,
      status: expDays < 0 ? "expired" : expDays < 30 ? "near-exp" : qty < 500 ? "low" : "ok",
      vendor: ["Glanbia", "FrieslandCampina", "Cargill", "ADM", "Tate & Lyle", "Olam"][Math.floor(r()*6)],
    });
  }
  return out;
}

// Reconciliation items
const RECON_ITEMS = [
  { id: "RC-2417", material: "100-2034", desc: "Whey Protein Isolate 90% Instantized", plant: "1000", sloc: "0001", im_qty: 14250, wm_qty: 13980, delta: -270, kind: "true",    age_h: 36, owner: "S. Murphy",     status: "open",        reason: null,                              priority: 3, value_eur: 18900 },
  { id: "RC-2418", material: "200-4419", desc: "Vegetable Stock Powder Low-Sodium",     plant: "3000", sloc: "INTR", im_qty:  3120, wm_qty:  3340, delta: +220, kind: "timing",  age_h:  2, owner: "M. de Vries",   status: "auto-clearing", reason: "TO confirmation pending",          priority: 1, value_eur:  1450 },
  { id: "RC-2419", material: "300-1108", desc: "Lactose Monohydrate USP Pharma Grade",  plant: "1000", sloc: "QM01", im_qty:  8800, wm_qty:  8800, delta:    0, kind: "interim", age_h:  6, owner: "Unassigned",    status: "open",        reason: "QI pending — IM unrestricted, WM still QI", priority: 2, value_eur: 12200 },
  { id: "RC-2420", material: "500-3301", desc: "Lipid Encapsulate Omega-3 LipidShield", plant: "2000", sloc: "0003", im_qty:  6450, wm_qty:  5900, delta: -550, kind: "true",    age_h: 72, owner: "K. Patel",      status: "investigating", reason: "Suspected miscount — bin BL-12-04",  priority: 4, value_eur: 41200 },
  { id: "RC-2421", material: "400-7701", desc: "Yeast Extract — Savoury Profile YE-12", plant: "3000", sloc: "0001", im_qty:  9100, wm_qty:  9080, delta:  -20, kind: "true",    age_h: 18, owner: "M. de Vries",   status: "open",        reason: null,                              priority: 2, value_eur:    280 },
  { id: "RC-2422", material: "100-2891", desc: "Sodium Caseinate Spray-Dried",          plant: "4000", sloc: "INTR", im_qty:  2850, wm_qty:  2950, delta: +100, kind: "timing",  age_h:  1, owner: "Auto",          status: "auto-clearing", reason: "Interim — putaway in progress",      priority: 1, value_eur:    620 },
  { id: "RC-2423", material: "500-3318", desc: "Probiotic Blend HOWARU® Premium",       plant: "1000", sloc: "BL01", im_qty:  1240, wm_qty:  1240, delta:    0, kind: "interim", age_h: 22, owner: "S. Murphy",     status: "open",        reason: "Block code Z03 — IM cleared, WM still blocked", priority: 3, value_eur:  7400 },
  { id: "RC-2424", material: "800-2240", desc: "Cocoa Powder Natural 10/12 Alkalized",  plant: "5000", sloc: "0001", im_qty: 11600, wm_qty: 10900, delta: -700, kind: "true",    age_h: 96, owner: "L. Costa",      status: "investigating", reason: "Cycle count variance — under review",  priority: 4, value_eur: 14700 },
  { id: "RC-2425", material: "300-1112", desc: "Maltodextrin DE-19",                    plant: "2000", sloc: "0001", im_qty: 18400, wm_qty: 18380, delta:  -20, kind: "true",    age_h:  8, owner: "Unassigned",    status: "open",        reason: null,                              priority: 1, value_eur:    180 },
  { id: "RC-2426", material: "400-7732", desc: "Natural Flavour — Roasted Onion N-220", plant: "3000", sloc: "QM01", im_qty:   720, wm_qty:   720, delta:    0, kind: "interim", age_h: 48, owner: "M. de Vries",   status: "open",        reason: "Status mismatch (UU vs QI)",        priority: 2, value_eur:    340 },
  { id: "RC-2427", material: "200-4412", desc: "Beef Bouillon Concentrate Type-3",      plant: "1000", sloc: "0003", im_qty:  4220, wm_qty:  4220, delta:    0, kind: "match",   age_h:  0, owner: "—",             status: "resolved",    reason: "Cleared automatically",            priority: 1, value_eur:      0 },
  { id: "RC-2428", material: "100-2034", desc: "Whey Protein Isolate 90% Instantized",  plant: "2000", sloc: "INTR", im_qty:  1800, wm_qty:  2100, delta: +300, kind: "timing",  age_h:  3, owner: "Auto",          status: "auto-clearing", reason: "Inbound delivery 8094221 — putaway open", priority: 1, value_eur:   2200 },
];

const EXCEPTIONS = [
  { id: "EX-9821", type: "Negative stock",        material: "200-4419", plant: "3000", sloc: "0001", severity: 4, sla_h:  4, age_h:  6, owner: "M. de Vries", status: "open",        details: "WM quant -120 KG in bin RT-A-08-02" },
  { id: "EX-9822", type: "Aged QI > 14d",          material: "300-1108", plant: "1000", sloc: "QM01", severity: 3, sla_h: 24, age_h: 18, owner: "S. Murphy",   status: "in-progress", details: "Batch B2026114-2 — 8,800 KG locked" },
  { id: "EX-9823", type: "Bin over-capacity",      material: "—",        plant: "1000", sloc: "—",    severity: 2, sla_h: 24, age_h: 22, owner: "Unassigned",  status: "open",        details: "Storage type 0010 utilization 102%" },
  { id: "EX-9824", type: "Expired batch present",  material: "800-2240", plant: "5000", sloc: "0003", severity: 4, sla_h:  2, age_h:  1, owner: "L. Costa",    status: "open",        details: "Batch B2025332-1 expired 3d ago — 410 KG" },
  { id: "EX-9825", type: "Open TO > 24h",          material: "100-2034", plant: "1000", sloc: "INTR", severity: 3, sla_h: 24, age_h: 36, owner: "S. Murphy",   status: "open",        details: "TO 0001294821 — putaway from 921" },
  { id: "EX-9826", type: "Blocked stock aged",     material: "500-3318", plant: "1000", sloc: "BL01", severity: 2, sla_h: 72, age_h: 22, owner: "S. Murphy",   status: "open",        details: "Block reason Z03 — disposition required" },
  { id: "EX-9827", type: "IM/WM variance > 1%",    material: "500-3301", plant: "2000", sloc: "0003", severity: 4, sla_h:  8, age_h: 72, owner: "K. Patel",    status: "in-progress", details: "Variance -550 KG (-8.5%) — RC-2420" },
  { id: "EX-9828", type: "Slow mover (>180d)",     material: "400-7732", plant: "3000", sloc: "0001", severity: 1, sla_h:  0, age_h:240, owner: "Auto",         status: "monitor",     details: "0 issues in 218 days — €18,400 value" },
  { id: "EX-9829", type: "Storage type imbalance", material: "—",        plant: "3000", sloc: "—",    severity: 2, sla_h: 48, age_h: 30, owner: "M. de Vries", status: "open",        details: "ST 0020 87% / ST 0010 42% — rebalance" },
  { id: "EX-9830", type: "Negative stock",         material: "600-9120", plant: "4000", sloc: "0002", severity: 4, sla_h:  4, age_h:  2, owner: "Unassigned",  status: "open",        details: "WM quant -45 KG in bin JH-B-12-01" },
  { id: "EX-9831", type: "Aged QI > 14d",          material: "100-2891", plant: "1000", sloc: "QM01", severity: 3, sla_h: 24, age_h: 14, owner: "S. Murphy",   status: "open",        details: "Batch B2026102-1 — 4,200 KG" },
  { id: "EX-9832", type: "Cycle count due",        material: "—",        plant: "2000", sloc: "—",    severity: 1, sla_h: 96, age_h: 10, owner: "K. Patel",    status: "monitor",     details: "BL01 — 1,240 bins overdue" },
];

const MOVEMENTS = [
  { time: "12:42", code: "311", desc: "Transfer SLoc to SLoc", material: "100-2034", plant: "1000", qty: -480,  uom: "KG", user: "MURPHY_S",  doc: "4900012894" },
  { time: "12:41", code: "101", desc: "Goods receipt PO",      material: "300-1108", plant: "1000", qty: +9000, uom: "KG", user: "WM_AUTO",   doc: "5000028841" },
  { time: "12:38", code: "201", desc: "Goods issue cost ctr",  material: "600-9135", plant: "2000", qty: -120,  uom: "KG", user: "PATEL_K",   doc: "4900012893" },
  { time: "12:35", code: "321", desc: "Transfer Q-insp → unrestr.", material: "300-1112", plant: "2000", qty: +18380, uom: "KG", user: "QM_REL", doc: "4900012892" },
  { time: "12:33", code: "344", desc: "Unrestr. → blocked",    material: "500-3318", plant: "1000", qty: -1240, uom: "KG", user: "MURPHY_S",  doc: "4900012891" },
  { time: "12:30", code: "601", desc: "Goods issue delivery",   material: "200-4419", plant: "3000", qty: -2200, uom: "KG", user: "DEVRIES_M", doc: "8000091221" },
  { time: "12:27", code: "311", desc: "Transfer SLoc to SLoc", material: "400-7701", plant: "3000", qty: +600,  uom: "KG", user: "WM_AUTO",   doc: "4900012890" },
  { time: "12:24", code: "101", desc: "Goods receipt PO",      material: "800-2240", plant: "5000", qty: +5500, uom: "KG", user: "WM_AUTO",   doc: "5000028840" },
];

// Plant-level summary (computed)
function plantSummary(rows) {
  return PLANTS.map(p => {
    const pr = rows.filter(r => r.plant === p.code);
    const im_total = pr.reduce((s,r) => s + r.im_total, 0);
    const wm_total = pr.reduce((s,r) => s + r.wm_total, 0);
    const value_eur = pr.reduce((s,r) => s + r.value_eur, 0);
    const mismatches = pr.filter(r => r.mismatch_kind !== "match").length;
    const true_mm    = pr.filter(r => r.mismatch_kind === "true").length;
    const interim    = pr.reduce((s,r) => s + r.interim, 0);
    return { ...p, im_total, wm_total, value_eur, mismatches, true_mm, interim, lines: pr.length };
  });
}

// 30-day trend (deterministic)
function makeTrend(seed, base, vol = 0.05, drift = 0) {
  const r = rng(seed);
  const out = [];
  let v = base;
  for (let i = 0; i < 30; i++) {
    v = v * (1 + drift) + (r() - 0.5) * base * vol;
    out.push(Math.max(0, Math.round(v)));
  }
  return out;
}

// Storage type / bin data for WM Explorer
const STORAGE_TYPES = [
  { whse: "NS01", st: "0010", name: "High Bay Racking",  bins: 4200, used: 3486, util: 0.83, open_to: 12, hot: false },
  { whse: "NS01", st: "0020", name: "Pallet Storage",    bins: 1800, used: 1152, util: 0.64, open_to:  3, hot: false },
  { whse: "NS01", st: "0030", name: "Carton Flow",       bins:  900, used:  765, util: 0.85, open_to:  8, hot: true  },
  { whse: "NS01", st: "0050", name: "Bulk Floor",        bins:   60, used:   58, util: 0.97, open_to:  2, hot: true  },
  { whse: "NS01", st: "0080", name: "Pick Face",         bins:  420, used:  324, util: 0.77, open_to: 14, hot: false },
  { whse: "NS01", st: "0910", name: "Goods Receipt Z.",  bins:   40, used:   31, util: 0.78, open_to:  6, hot: false },
  { whse: "NS01", st: "0921", name: "Interim Putaway",   bins:   80, used:   62, util: 0.78, open_to: 18, hot: true  },
  { whse: "NS01", st: "0922", name: "Interim Pick",      bins:   80, used:   44, util: 0.55, open_to: 11, hot: false },
  { whse: "NS01", st: "0930", name: "Goods Issue Z.",    bins:   40, used:   18, util: 0.45, open_to:  4, hot: false },
];

const BINS_SAMPLE = [
  { bin: "NS-01-A-01-01", st: "0010", material: "100-2034", batch: "B2026114-2", qty: 1080, uom: "KG", status: "U", to: null,            verified_h: 6 },
  { bin: "NS-01-A-01-02", st: "0010", material: "100-2034", batch: "B2026115-1", qty:  640, uom: "KG", status: "U", to: null,            verified_h: 6 },
  { bin: "NS-01-A-01-03", st: "0010", material: "200-4419", batch: "B2026021-3", qty:    0, uom: "KG", status: "—", to: null,            verified_h: 12 },
  { bin: "NS-01-A-01-04", st: "0010", material: "300-1108", batch: "B2026114-2", qty: 8800, uom: "KG", status: "Q", to: null,            verified_h: 18 },
  { bin: "NS-01-921-01",  st: "0921", material: "100-2034", batch: "B2026120-1", qty: 2400, uom: "KG", status: "I", to: "TO 0001294821", verified_h: 36 },
  { bin: "NS-01-921-02",  st: "0921", material: "500-3318", batch: "B2026019-1", qty:  720, uom: "KG", status: "I", to: "TO 0001294822", verified_h:  4 },
  { bin: "NS-01-B-04-12", st: "0050", material: "300-1112", batch: "B2025290-1", qty:18380, uom: "KG", status: "U", to: null,            verified_h:  2 },
  { bin: "NS-01-BL-01",   st: "0080", material: "500-3318", batch: "B2025301-2", qty: 1240, uom: "KG", status: "B", to: null,            verified_h: 22 },
];

// Aging / obsolescence buckets
const AGING_BUCKETS = [
  { label: "0–30d",   value: 12.4, color: "var(--c-success)" },
  { label: "31–60d",  value:  8.7, color: "var(--c-success)" },
  { label: "61–90d",  value:  5.2, color: "var(--c-info)" },
  { label: "91–180d", value:  3.4, color: "var(--c-warning)" },
  { label: "181–365d", value: 1.8, color: "var(--c-warning)" },
  { label: ">365d",   value:  0.9, color: "var(--c-danger)" },
];

const ABC_XYZ = [
  { abc: "A", xyz: "X", lines: 184, value: 32.4, label: "Strategic & stable" },
  { abc: "A", xyz: "Y", lines:  62, value: 11.2, label: "High value, variable" },
  { abc: "A", xyz: "Z", lines:  18, value:  3.8, label: "High value, erratic" },
  { abc: "B", xyz: "X", lines: 240, value: 12.6, label: "Standard stable" },
  { abc: "B", xyz: "Y", lines: 142, value:  6.1, label: "Standard variable" },
  { abc: "B", xyz: "Z", lines:  44, value:  1.4, label: "Standard erratic" },
  { abc: "C", xyz: "X", lines: 480, value:  3.2, label: "Tail stable" },
  { abc: "C", xyz: "Y", lines: 320, value:  1.2, label: "Tail variable" },
  { abc: "C", xyz: "Z", lines: 188, value:  0.6, label: "Tail erratic" },
];

const STOCK_ROWS = buildInventoryRows("live");

window.__INV_DATA__ = {
  PLANTS, MATERIALS, MATERIAL_TYPES, STORAGE_LOCS, STORAGE_LOC_NAMES, STOCK_TYPES,
  RECON_ITEMS, EXCEPTIONS, MOVEMENTS, STORAGE_TYPES, BINS_SAMPLE, AGING_BUCKETS, ABC_XYZ,
  STOCK_ROWS,
  buildInventoryRows, buildBatches, plantSummary, makeTrend, fmt,
};
