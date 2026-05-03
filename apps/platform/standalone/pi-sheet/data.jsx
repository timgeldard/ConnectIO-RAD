/* === Mock data — realistic SAP PP-PI === */

const PROCESS_ORDERS = [
  {
    id: "PO-1004821",
    material: "FZG-Lemon Citrus Concentrate 35%",
    materialNo: "MAT-100-44821",
    batch: "B26-04821",
    qty: { planned: 4500, uom: "KG" },
    line: "Line 03 — Reactor R-204",
    plant: "Beloit, WI",
    shift: "B",
    priority: "high",
    status: "ready",
    progress: 0,
    phase: "1 of 6",
    due: "Today, 16:00",
    customer: "Pepsico — NA Beverages",
  },
  {
    id: "PO-1004812",
    material: "Savory Roast Chicken Seasoning Blend",
    materialNo: "MAT-220-91183",
    batch: "B26-04812",
    qty: { planned: 1200, uom: "KG" },
    line: "Line 01 — Blender B-101",
    plant: "Beloit, WI",
    shift: "B",
    priority: "med",
    status: "in_progress",
    progress: 38,
    phase: "3 of 8",
    due: "Today, 18:30",
    customer: "Tyson Foods — Foodservice",
    isMine: true,
  },
  {
    id: "PO-1004807",
    material: "Vanilla Cream Flavor System (FCC)",
    materialNo: "MAT-180-30021",
    batch: "B26-04807",
    qty: { planned: 800, uom: "KG" },
    line: "Line 02 — Mixer M-301",
    plant: "Beloit, WI",
    shift: "B",
    priority: "med",
    status: "exception",
    progress: 62,
    phase: "5 of 7",
    due: "Today, 14:45",
    customer: "Nestlé Ice Cream",
    exceptionReason: "pH out of tolerance (5.8 vs 4.0–5.0)",
  },
  {
    id: "PO-1004801",
    material: "Cheddar Cheese Powder Type II",
    materialNo: "MAT-310-77804",
    batch: "B26-04801",
    qty: { planned: 2200, uom: "KG" },
    line: "Line 04 — Spray Dryer SD-401",
    plant: "Beloit, WI",
    shift: "B",
    priority: "low",
    status: "blocked",
    progress: 12,
    phase: "2 of 9",
    due: "Today, 22:00",
    customer: "Frito-Lay — Snacks",
    exceptionReason: "Awaiting QA release of MAT-440-22918 (Cheese curd)",
  },
  {
    id: "PO-1004799",
    material: "Tropical Punch Beverage Base",
    materialNo: "MAT-100-58219",
    batch: "B26-04799",
    qty: { planned: 3000, uom: "KG" },
    line: "Line 03 — Reactor R-204",
    plant: "Beloit, WI",
    shift: "B",
    priority: "low",
    status: "ready",
    progress: 0,
    phase: "1 of 6",
    due: "Tomorrow, 06:00",
    customer: "Coca-Cola — NA",
  },
  {
    id: "PO-1004788",
    material: "Smoke BBQ Flavor System",
    materialNo: "MAT-220-66401",
    batch: "B26-04788",
    qty: { planned: 600, uom: "KG" },
    line: "Line 01 — Blender B-101",
    plant: "Beloit, WI",
    shift: "B",
    priority: "high",
    status: "complete",
    progress: 100,
    phase: "Done",
    due: "Today, 10:00",
    customer: "Kraft-Heinz",
  },
];

// Active execution: PO-1004812 — Savory Roast Chicken Seasoning Blend
const ACTIVE_ORDER = {
  id: "PO-1004812",
  material: "Savory Roast Chicken Seasoning Blend",
  materialNo: "MAT-220-91183",
  batch: "B26-04812",
  qtyPlanned: 1200,
  uom: "KG",
  line: "Line 01 — Blender B-101",
  plant: "Beloit, WI",
  recipe: "RECIPE-220-V14",
  controlRecipe: "CR-220-91183-04812",
  customer: "Tyson Foods — Foodservice",
  startedAt: "2026-05-02 13:42",
  due: "2026-05-02 18:30",
  operator: "M. Chen",
  shift: "B",
};

const PHASES = [
  { id: 1, name: "Pre-charge inspection", status: "done", duration: "12m" },
  { id: 2, name: "Charge dry components", status: "done", duration: "28m" },
  { id: 3, name: "Blend & homogenize", status: "current", duration: "—" },
  { id: 4, name: "In-process QC sample", status: "pending", duration: "—" },
  { id: 5, name: "Sieve & magnet pass", status: "pending", duration: "—" },
  { id: 6, name: "Bulk transfer to packout", status: "pending", duration: "—" },
  { id: 7, name: "Goods receipt confirmation", status: "pending", duration: "—" },
  { id: 8, name: "Phase close & sign-off", status: "pending", duration: "—" },
];

// Steps within current phase 3 — "Blend & homogenize"
const PHASE_3_STEPS = [
  { id: "3.1", title: "Confirm reactor charge totals", desc: "Verify all dry charges from Phase 2 are recorded. Visually inspect blender chamber for residue from previous batch.", status: "done", kind: "checklist" },
  { id: "3.2", title: "Set blender speed and start", desc: "Set agitation to recipe target. Start ribbon blender and confirm rotation direction. Record start time.", status: "done", kind: "params" },
  { id: "3.3", title: "Capture mid-blend process parameters", desc: "After 8 minutes of blend time, record temperature, ribbon torque, and chamber pressure. All values must be within tolerance to advance.", status: "current", kind: "params" },
  { id: "3.4", title: "Confirm blend duration", desc: "Continue blend for full 22 minutes from start. System will signal completion. Confirm end time and stop blender.", status: "pending", kind: "timed" },
  { id: "3.5", title: "Visual homogeneity check", desc: "Open inspection port and verify visual homogeneity. Capture photo if requested by QA.", status: "pending", kind: "checklist" },
];

// Step 3.3 parameters
const STEP_3_3_PARAMS = [
  { id: "p1", name: "Blend chamber temperature", desc: "T-101 RTD — chamber midpoint", target: 32.0, lo: 28.0, hi: 36.0, unit: "°C", current: 31.4, captured: false, icon: "thermometer" },
  { id: "p2", name: "Ribbon torque", desc: "Drive motor amperage at steady-state", target: 14.5, lo: 12.0, hi: 17.0, unit: "A", current: 14.2, captured: false, icon: "activity" },
  { id: "p3", name: "Chamber pressure", desc: "Differential pressure to ambient", target: 0.0, lo: -0.5, hi: 0.5, unit: "kPa", current: 0.1, captured: false, icon: "droplet" },
  { id: "p4", name: "Moisture (NIR probe)", desc: "Online NIR sensor — % w/w", target: 4.5, lo: 3.5, hi: 5.5, unit: "%", current: 4.3, captured: false, icon: "droplet" },
];

const COMPONENTS = [
  { matNo: "MAT-440-10221", name: "Salt — fine grade",                  batch: "S-2025-1184",   planned: 384.0, actual: 384.2, uom: "KG", status: "issued" },
  { matNo: "MAT-440-22918", name: "Onion powder — toasted",             batch: "OP-2025-0344",  planned: 240.0, actual: 240.0, uom: "KG", status: "issued" },
  { matNo: "MAT-440-30715", name: "Garlic powder",                       batch: "GP-2025-0511",  planned: 144.0, actual: 144.1, uom: "KG", status: "issued" },
  { matNo: "MAT-440-58122", name: "Yeast extract — savory note",        batch: "YE-2025-0190",  planned: 192.0, actual: 192.0, uom: "KG", status: "issued" },
  { matNo: "MAT-440-66301", name: "Roast chicken flavor (Kerry IP)",    batch: "RCF-25-0078",   planned: 96.0,  actual: 95.8,  uom: "KG", status: "issued", flag: "low" },
  { matNo: "MAT-440-71005", name: "Maltodextrin DE-10",                  batch: "MD-2025-1205",  planned: 132.0, actual: 132.0, uom: "KG", status: "issued" },
  { matNo: "MAT-440-83320", name: "Black pepper — coarse",               batch: "BP-2025-0921",  planned: 12.0,  actual: 12.0,  uom: "KG", status: "issued" },
];

const ALL_PHASES_TIMELINE = [
  { ts: "13:42:08", who: "M. Chen", type: "phase", txt: "Phase 1 — Pre-charge inspection started" },
  { ts: "13:54:21", who: "M. Chen", type: "phase", txt: "Phase 1 closed — sign-off recorded" },
  { ts: "13:54:35", who: "M. Chen", type: "phase", txt: "Phase 2 — Charge dry components started" },
  { ts: "14:02:11", who: "system",  type: "post",  txt: "GI 261 posted — MAT-440-10221 384.2 KG" },
  { ts: "14:09:44", who: "system",  type: "post",  txt: "GI 261 posted — MAT-440-22918 240.0 KG" },
  { ts: "14:14:02", who: "system",  type: "post",  txt: "GI 261 posted — MAT-440-30715 144.1 KG" },
  { ts: "14:18:50", who: "system",  type: "post",  txt: "GI 261 posted — MAT-440-58122 192.0 KG" },
  { ts: "14:21:33", who: "M. Chen", type: "note",  txt: "Note: scoop calibration verified at start of phase" },
  { ts: "14:23:07", who: "system",  type: "post",  txt: "GI 261 posted — MAT-440-66301 95.8 KG (var -0.2)" },
  { ts: "14:23:09", who: "system",  type: "warn",  txt: "Variance flag — flavor charge 0.21% below target" },
  { ts: "14:28:14", who: "M. Chen", type: "phase", txt: "Phase 2 closed — sign-off recorded" },
  { ts: "14:28:30", who: "M. Chen", type: "phase", txt: "Phase 3 — Blend & homogenize started" },
];

const SUPERVISOR_LINES = [
  { id: "L01", name: "Line 01 — Blender B-101", state: "running", order: "PO-1004812", phase: "Blend & homogenize", op: "M. Chen", oee: 92, exceptions: 0 },
  { id: "L02", name: "Line 02 — Mixer M-301",   state: "exception", order: "PO-1004807", phase: "In-process QC", op: "R. Patel", oee: 71, exceptions: 1 },
  { id: "L03", name: "Line 03 — Reactor R-204", state: "ready", order: "PO-1004821", phase: "Pre-charge", op: "—", oee: 0, exceptions: 0 },
  { id: "L04", name: "Line 04 — Spray Dryer SD-401", state: "blocked", order: "PO-1004801", phase: "QA hold", op: "T. Okafor", oee: 0, exceptions: 1 },
  { id: "L05", name: "Line 05 — Reactor R-205", state: "running", order: "PO-1004814", phase: "Reaction hold", op: "S. Garza", oee: 88, exceptions: 0 },
  { id: "L06", name: "Line 06 — Filler F-501",  state: "changeover", order: "—", phase: "CIP / changeover", op: "—", oee: 0, exceptions: 0 },
];

const EXCEPTIONS = [
  { id: "EX-2841", order: "PO-1004807", phase: "5 — In-process QC", reason: "pH out of tolerance (5.8 vs 4.0–5.0)", severity: "critical", openedAt: "13:58", openedBy: "system", state: "open" },
  { id: "EX-2840", order: "PO-1004801", phase: "2 — QA release",    reason: "Awaiting QA release MAT-440-22918",        severity: "blocking", openedAt: "13:30", openedBy: "T. Okafor", state: "hold" },
  { id: "EX-2839", order: "PO-1004812", phase: "2 — Charge dry",    reason: "Flavor charge -0.21% under target",        severity: "info",     openedAt: "14:23", openedBy: "system", state: "monitoring" },
];

const EBR_SECTIONS = [
  { num: "1.0", title: "Order header & control recipe",        sigs: 2, count: 12 },
  { num: "2.0", title: "Phase 1 — Pre-charge inspection",      sigs: 2, count: 6 },
  { num: "3.0", title: "Phase 2 — Charge dry components",      sigs: 3, count: 14 },
  { num: "4.0", title: "Phase 3 — Blend & homogenize",         sigs: 0, count: 9, current: true },
  { num: "5.0", title: "Phase 4 — In-process QC sample",       sigs: 0, count: 0, pending: true },
  { num: "6.0", title: "Phase 5 — Sieve & magnet pass",        sigs: 0, count: 0, pending: true },
  { num: "7.0", title: "Phase 6 — Bulk transfer to packout",   sigs: 0, count: 0, pending: true },
  { num: "8.0", title: "Phase 7 — Goods receipt",              sigs: 0, count: 0, pending: true },
  { num: "9.0", title: "Deviations & exceptions",              sigs: 0, count: 1 },
  { num: "10.0", title: "Genealogy & batch linkage",           sigs: 0, count: 8 },
  { num: "11.0", title: "Review comments",                     sigs: 0, count: 0 },
  { num: "12.0", title: "Approval signatures",                 sigs: 0, count: 0, pending: true },
];

const ANALYTICS_KPIS = [
  { lbl: "Active orders",         val: "23",     sub: "+4 vs avg",    delta: "up",   data: [12,14,18,16,20,19,23] },
  { lbl: "On-time completion",    val: "94.2%",  sub: "30-day rolling", delta: "up", data: [88,90,91,89,92,93,94.2] },
  { lbl: "Open exceptions",       val: "7",      sub: "2 critical",   delta: "down", data: [9,10,8,11,9,8,7] },
  { lbl: "Avg phase cycle time",  val: "26.4 m", sub: "-1.8m vs plan", delta: "up", data: [29,28,28,27,27,26.5,26.4] },
  { lbl: "Yield variance",        val: "+0.4%",  sub: "in tolerance", delta: "up",  data: [-0.6,-0.2,0.1,0.0,0.3,0.2,0.4] },
  { lbl: "First-time-right",      val: "97.1%",  sub: "vs 95% target", delta: "up", data: [93,94,95,96,96.5,97,97.1] },
];

window.MOCK = {
  PROCESS_ORDERS, ACTIVE_ORDER, PHASES, PHASE_3_STEPS, STEP_3_3_PARAMS,
  COMPONENTS, ALL_PHASES_TIMELINE, SUPERVISOR_LINES, EXCEPTIONS,
  EBR_SECTIONS, ANALYTICS_KPIS,
};
