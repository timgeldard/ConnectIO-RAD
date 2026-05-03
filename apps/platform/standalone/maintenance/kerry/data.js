// ============================================================================
// ConnectIO-RAD · Plant Maintenance — Mock data
// Pretend this came from Databricks Gold semantic models
// Plant: Kerry Beloit (USA) · F&B processing
// ============================================================================

const PLANTS = [
  { id: "BLT", name: "Beloit, WI",      country: "USA"     },
  { id: "ROC", name: "Rochester, NY",   country: "USA"     },
  { id: "NRW", name: "Naas, IE",        country: "Ireland" },
  { id: "SHA", name: "Shanghai, CN",    country: "China"   },
];

const WORK_CENTERS = [
  { id: "MECH-A", name: "Mechanical · Process",     hours: 320 },
  { id: "MECH-B", name: "Mechanical · Packaging",   hours: 280 },
  { id: "ELEC",   name: "Electrical & Instruments", hours: 200 },
  { id: "AUTO",   name: "Controls / Automation",    hours: 160 },
  { id: "UTIL",   name: "Utilities",                hours: 120 },
  { id: "SAN",    name: "Sanitation Engineering",   hours: 80  },
];

const PLANNERS = [
  { id: "P-100", name: "Aoife Brennan",  initials: "AB", workload: 78 },
  { id: "P-101", name: "Marcus Holloway", initials: "MH", workload: 92 },
  { id: "P-102", name: "Priya Iyer",     initials: "PI", workload: 64 },
  { id: "P-103", name: "Tomás Reyes",    initials: "TR", workload: 71 },
];

// KPI summary for control tower
const KPI_SUMMARY = {
  backlog_orders:    { value: 1247, unit: "orders", trend: "+8.2%", dir: "up-bad",   target: 950, status: "watch" },
  backlog_hours:     { value: 8420, unit: "hrs",    trend: "+312",  dir: "up-bad",   status: "watch" },
  pm_compliance:     { value: 87.4, unit: "%",      trend: "+1.2pp", dir: "up", target: 95, status: "watch" },
  schedule_compliance:{value: 79.1, unit: "%",      trend: "-2.4pp", dir: "down", target: 85, status: "critical" },
  mttr:              { value: 4.8,  unit: "hrs",    trend: "-0.6", dir: "down-good", status: "ok" },
  mtbf:              { value: 142,  unit: "hrs",    trend: "+12",  dir: "up", status: "ok" },
  availability:      { value: 96.2, unit: "%",      trend: "-0.4pp", dir: "down", target: 97.5, status: "watch" },
  critical_open:     { value: 23,   unit: "items",  trend: "+4",   dir: "up-bad",   status: "critical" },
  overdue_pm:        { value: 41,   unit: "items",  trend: "+9",   dir: "up-bad",   status: "critical" },
  open_breakdowns:   { value: 6,    unit: "active", trend: "+2",   dir: "up-bad",   status: "critical" },
  downtime_72h:      { value: 14.6, unit: "hrs",    trend: "+3.1", dir: "up-bad",   status: "watch" },
};

// Sparkline values (12 weeks)
const SPARKS = {
  backlog_orders:  [1108,1130,1142,1165,1180,1172,1188,1201,1212,1220,1235,1247],
  backlog_hours:   [7600,7720,7780,7910,7990,8020,8095,8180,8260,8310,8380,8420],
  pm_compliance:   [85.2,85.4,85.8,86.0,86.2,86.4,86.6,86.7,86.9,87.0,87.2,87.4],
  schedule_compliance:[83.1,82.6,82.2,81.5,81.0,80.7,80.4,80.0,79.8,79.6,79.3,79.1],
  mttr:            [5.6,5.5,5.4,5.3,5.2,5.1,5.0,4.95,4.9,4.85,4.82,4.8],
  mtbf:            [118,121,124,127,130,133,135,137,138,139,140,142],
  availability:    [96.8,96.9,96.7,96.6,96.5,96.4,96.5,96.4,96.3,96.3,96.2,96.2],
  critical_open:   [12,14,15,16,17,18,19,20,21,21,22,23],
  downtime_72h:    [9.8,10.2,11.1,11.5,12.0,12.4,12.9,13.2,13.6,13.8,14.2,14.6],
};

// Work mix composition (planned vs unplanned, prev/corr/emer)
const WORK_MIX = {
  by_type: [
    { label: "Preventive",  count: 612, pct: 49.1, color: "var(--chart-1)" },
    { label: "Corrective",  count: 478, pct: 38.3, color: "var(--chart-2)" },
    { label: "Emergency",   count: 92,  pct: 7.4,  color: "var(--critical)" },
    { label: "Project",     count: 65,  pct: 5.2,  color: "var(--chart-4)" },
  ],
  planned_unplanned: { planned: 78.2, unplanned: 21.8 },
};

// Backlog by age & priority (heatmap-ish)
const BACKLOG_AGE = {
  ages: ["0–7d", "8–14d", "15–30d", "31–60d", "61–90d", "90d+"],
  priorities: ["P1 Emergency", "P2 High", "P3 Medium", "P4 Low"],
  // hours
  matrix: [
    [120,  240, 380, 290,  140,  60],   // P1
    [380,  620, 880, 720,  410, 240],   // P2
    [520,  780,1040, 980,  720, 460],   // P3
    [180,  340, 520, 640,  580, 480],   // P4
  ],
};

const BACKLOG_BY_WC = WORK_CENTERS.map((wc, i) => ({
  ...wc,
  open: [184, 156, 142, 98, 76, 54][i],
  hours: [2480, 1820, 1240, 980, 720, 480][i],
  overdue_pct: [22, 18, 14, 28, 12, 9][i],
  critical: [6, 4, 3, 5, 3, 2][i],
}));

// Top bad actors (functional locations / equipment)
const BAD_ACTORS = [
  { id:"BLT-PRO-DRY-02", name:"Spray Dryer #2",        floc:"BLT.PRO.DRY.02", failures:9,  downtime:42.6, mtbf:78,  cost:128400, trend:"up-bad" },
  { id:"BLT-PRO-EVA-01", name:"Falling-film Evap. #1",  floc:"BLT.PRO.EVA.01", failures:7,  downtime:31.2, mtbf:104, cost: 96200, trend:"up-bad" },
  { id:"BLT-PKG-FIL-04", name:"Aseptic Filler Line 4", floc:"BLT.PKG.FIL.04", failures:6,  downtime:28.4, mtbf:122, cost: 88700, trend:"flat" },
  { id:"BLT-UTL-COM-02", name:"Ammonia Compressor #2", floc:"BLT.UTL.COM.02", failures:5,  downtime:21.8, mtbf:148, cost: 72900, trend:"down-good" },
  { id:"BLT-PRO-MIX-08", name:"High-shear Mixer #8",   floc:"BLT.PRO.MIX.08", failures:4,  downtime:14.2, mtbf:188, cost: 41200, trend:"down-good" },
  { id:"BLT-PKG-CAP-02", name:"Capper #2",             floc:"BLT.PKG.CAP.02", failures:4,  downtime:11.6, mtbf:201, cost: 38400, trend:"flat" },
  { id:"BLT-UTL-BOI-01", name:"Boiler #1",             floc:"BLT.UTL.BOI.01", failures:3,  downtime:18.2, mtbf:240, cost: 64200, trend:"flat" },
];

// Failure modes (Pareto)
const FAILURE_MODES = [
  { code:"BRG", label:"Bearing failure",           count: 38, share: 22.4, mttr: 5.2 },
  { code:"SEA", label:"Seal leakage",              count: 31, share: 18.2, mttr: 3.6 },
  { code:"SNS", label:"Sensor / instrument fault", count: 24, share: 14.1, mttr: 2.1 },
  { code:"VLV", label:"Valve sticking",            count: 19, share: 11.2, mttr: 4.4 },
  { code:"BLT", label:"Belt / chain wear",         count: 15, share:  8.8, mttr: 3.1 },
  { code:"MTR", label:"Motor overheat",            count: 12, share:  7.0, mttr: 6.8 },
  { code:"CTL", label:"Control / PLC fault",       count: 11, share:  6.4, mttr: 5.4 },
  { code:"OTH", label:"Other / undiagnosed",       count: 20, share: 11.9, mttr: 4.0 },
];

// Notification types & priorities
const NOTIFICATIONS = [
  { id:"NTF-2284931", type:"Breakdown",  prio:"P1", floc:"BLT.PRO.DRY.02", equip:"Spray Dryer #2",       desc:"Vibration alarm, bearing temp 92°C", reportedBy:"J. Okafor", reportedAt:"2026-05-02T03:14",  status:"In progress",  age_h: 8,  order:"WO-501221", planner:"Marcus Holloway", failure:"BRG" },
  { id:"NTF-2284917", type:"Malfunction",prio:"P2", floc:"BLT.PRO.EVA.01", equip:"Falling-film Evap. #1", desc:"Steam pressure fluctuation",         reportedBy:"S. Park",   reportedAt:"2026-05-02T01:42",  status:"In progress",  age_h:10,  order:"WO-501218", planner:"Aoife Brennan",  failure:"SNS" },
  { id:"NTF-2284902", type:"Activity",   prio:"P3", floc:"BLT.PKG.FIL.04", equip:"Aseptic Filler Line 4", desc:"Sterile air filter change due",       reportedBy:"PM Schedule", reportedAt:"2026-05-01T22:00", status:"Released",     age_h:14, order:"WO-501205", planner:"Priya Iyer",     failure:null },
  { id:"NTF-2284891", type:"Breakdown",  prio:"P1", floc:"BLT.UTL.COM.02", equip:"Ammonia Compressor #2", desc:"Discharge temp high — auto trip",     reportedBy:"R. Hammond", reportedAt:"2026-05-01T19:31",  status:"Resolved",     age_h:18, order:"WO-501190", planner:"Tomás Reyes",    failure:"MTR" },
  { id:"NTF-2284878", type:"Malfunction",prio:"P2", floc:"BLT.PRO.MIX.08", equip:"High-shear Mixer #8",  desc:"Drive belt squeal during ramp-up",     reportedBy:"M. Khan",   reportedAt:"2026-05-01T16:08",  status:"Released",     age_h:21, order:"WO-501172", planner:"Marcus Holloway",failure:"BLT" },
  { id:"NTF-2284862", type:"Inspection", prio:"P3", floc:"BLT.UTL.BOI.01", equip:"Boiler #1",            desc:"Quarterly safety valve check",         reportedBy:"PM Schedule", reportedAt:"2026-05-01T08:00", status:"In progress",  age_h:29, order:"WO-501160", planner:"Aoife Brennan",  failure:null },
  { id:"NTF-2284851", type:"Breakdown",  prio:"P2", floc:"BLT.PKG.CAP.02", equip:"Capper #2",            desc:"Torque sensor erratic readings",       reportedBy:"L. Mendez",  reportedAt:"2026-05-01T04:22",  status:"In progress",  age_h:33, order:"WO-501148", planner:"Priya Iyer",     failure:"SNS" },
  { id:"NTF-2284836", type:"Quality",    prio:"P2", floc:"BLT.PKG.FIL.04", equip:"Aseptic Filler Line 4", desc:"Fill weight drift on station 3",      reportedBy:"QA-Auto",   reportedAt:"2026-04-30T22:14", status:"Outstanding",  age_h:47, order:null,          planner:null,             failure:"VLV" },
  { id:"NTF-2284820", type:"Malfunction",prio:"P3", floc:"BLT.PRO.HX.04",  equip:"Plate Heat Exch. #4",  desc:"Slight cross-leak, manageable",         reportedBy:"D. Wei",    reportedAt:"2026-04-30T11:10", status:"Outstanding",  age_h:58, order:null,          planner:"Tomás Reyes",    failure:"SEA" },
  { id:"NTF-2284805", type:"Inspection", prio:"P4", floc:"BLT.UTL.AHU.06", equip:"AHU-06 Powder Hall",   desc:"Filter ΔP threshold approaching",       reportedBy:"BMS",       reportedAt:"2026-04-29T18:42", status:"Released",     age_h:79, order:"WO-501088", planner:"Aoife Brennan",  failure:null },
  { id:"NTF-2284782", type:"Breakdown",  prio:"P1", floc:"BLT.PKG.FIL.02", equip:"Aseptic Filler Line 2", desc:"Servo fault, auto reset failed",      reportedBy:"H. Tanaka", reportedAt:"2026-04-29T03:20", status:"Resolved",     age_h:103, order:"WO-501070", planner:"Marcus Holloway",failure:"CTL" },
  { id:"NTF-2284763", type:"Activity",   prio:"P3", floc:"BLT.PRO.CIP.01", equip:"CIP Skid 1",           desc:"Quarterly conductivity probe cal.",     reportedBy:"PM Schedule", reportedAt:"2026-04-28T08:00", status:"In progress",  age_h:128, order:"WO-501052", planner:"Priya Iyer",     failure:null },
];

// Maintenance orders (richer than notifications)
const ORDERS = [
  { id:"WO-501221", type:"PM02 Corrective", prio:"P1", desc:"Replace bearing pair, dryer atomizer",  equip:"Spray Dryer #2",       floc:"BLT.PRO.DRY.02", wc:"MECH-A", planner:"Marcus Holloway", status:"In progress", pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:2, planned_h:18, actual_h:14.5, planned_cost:5800, actual_cost:5240, due:"2026-05-02", overdue:false, notif:"NTF-2284931" },
  { id:"WO-501218", type:"PM02 Corrective", prio:"P2", desc:"Steam regulator R&R",                    equip:"Falling-film Evap. #1", floc:"BLT.PRO.EVA.01", wc:"ELEC",   planner:"Aoife Brennan",   status:"In progress", pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:2, planned_h:8,  actual_h:6.2,  planned_cost:2200, actual_cost:1980, due:"2026-05-02", overdue:false, notif:"NTF-2284917" },
  { id:"WO-501205", type:"PM01 Preventive", prio:"P3", desc:"Sterile air filter element change",     equip:"Aseptic Filler Line 4", floc:"BLT.PKG.FIL.04", wc:"MECH-B", planner:"Priya Iyer",      status:"Released",    pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:1, planned_h:4,  actual_h:0,    planned_cost:1100, actual_cost:0,    due:"2026-05-03", overdue:false, notif:"NTF-2284902" },
  { id:"WO-501190", type:"PM02 Corrective", prio:"P1", desc:"Compressor motor temp investigation",   equip:"Ammonia Compressor #2", floc:"BLT.UTL.COM.02", wc:"MECH-A", planner:"Tomás Reyes",     status:"Tech.Comp",   pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:4, planned_h:6,  actual_h:7.8,  planned_cost:1800, actual_cost:2240, due:"2026-05-01", overdue:false, notif:"NTF-2284891" },
  { id:"WO-501172", type:"PM02 Corrective", prio:"P2", desc:"Drive belt replacement",                 equip:"High-shear Mixer #8",  floc:"BLT.PRO.MIX.08", wc:"MECH-B", planner:"Marcus Holloway", status:"Released",    pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:1, planned_h:3,  actual_h:0,    planned_cost:680,  actual_cost:0,    due:"2026-05-04", overdue:false, notif:"NTF-2284878" },
  { id:"WO-501160", type:"PM01 Preventive", prio:"P3", desc:"Boiler safety valve check",              equip:"Boiler #1",            floc:"BLT.UTL.BOI.01", wc:"UTIL",   planner:"Aoife Brennan",   status:"In progress", pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:2, planned_h:5,  actual_h:2.1,  planned_cost:920,  actual_cost:380,  due:"2026-05-02", overdue:false, notif:"NTF-2284862" },
  { id:"WO-501148", type:"PM02 Corrective", prio:"P2", desc:"Torque sensor calibration / replace",   equip:"Capper #2",            floc:"BLT.PKG.CAP.02", wc:"AUTO",   planner:"Priya Iyer",      status:"In progress", pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:2, planned_h:4,  actual_h:3.2,  planned_cost:1100, actual_cost:880,  due:"2026-05-02", overdue:false, notif:"NTF-2284851" },
  { id:"WO-501088", type:"PM01 Preventive", prio:"P4", desc:"AHU-06 filter change",                   equip:"AHU-06 Powder Hall",   floc:"BLT.UTL.AHU.06", wc:"UTIL",   planner:"Aoife Brennan",   status:"Released",    pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:1, planned_h:2,  actual_h:0,    planned_cost:340,  actual_cost:0,    due:"2026-05-05", overdue:false, notif:"NTF-2284805" },
  { id:"WO-500992", type:"PM01 Preventive", prio:"P3", desc:"Lubrication route — packaging hall",    equip:"Pkg Hall Equipment",   floc:"BLT.PKG",        wc:"MECH-B", planner:"Priya Iyer",      status:"Created",     pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:0, planned_h:6,  actual_h:0,    planned_cost:480,  actual_cost:0,    due:"2026-04-29", overdue:true,  notif:null },
  { id:"WO-500961", type:"PM01 Preventive", prio:"P3", desc:"Quarterly thermography route — MCC 4",  equip:"MCC-4",                floc:"BLT.UTL.MCC.04", wc:"ELEC",   planner:"Tomás Reyes",     status:"Created",     pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:0, planned_h:5,  actual_h:0,    planned_cost:600,  actual_cost:0,    due:"2026-04-27", overdue:true,  notif:null },
  { id:"WO-500944", type:"PM02 Corrective", prio:"P3", desc:"Replace conveyor idler — Line 3",       equip:"Conveyor Pkg Line 3",  floc:"BLT.PKG.CNV.03", wc:"MECH-B", planner:"Marcus Holloway", status:"Released",    pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:1, planned_h:3,  actual_h:0,    planned_cost:520,  actual_cost:0,    due:"2026-04-30", overdue:true,  notif:null },
  { id:"WO-500920", type:"PM03 Project",    prio:"P4", desc:"Install vibration sensors — dryer fans",equip:"Spray Dryer #1 fans",  floc:"BLT.PRO.DRY.01", wc:"AUTO",   planner:"Aoife Brennan",   status:"Released",    pipeline:["Created","Released","In progress","Confirmed","Tech.Comp"], stage:1, planned_h:24, actual_h:0,    planned_cost:8800, actual_cost:0,    due:"2026-05-12", overdue:false, notif:null },
];

// Operations on a selected order (drawer)
const OPERATIONS_501221 = [
  { id:"0010", desc:"LOTO and isolate process",        wc:"MECH-A", duration:0.5, status:"done"    },
  { id:"0020", desc:"Drain and de-pressurise",          wc:"MECH-A", duration:1.0, status:"done"    },
  { id:"0030", desc:"Remove atomizer head, inspect",   wc:"MECH-A", duration:2.5, status:"done"    },
  { id:"0040", desc:"Replace bearing pair (kit B-148)",wc:"MECH-A", duration:6.0, status:"active"  },
  { id:"0050", desc:"Reassemble, alignment, run-out",  wc:"MECH-A", duration:4.0, status:"todo"    },
  { id:"0060", desc:"Functional test, vibration check",wc:"AUTO",   duration:2.0, status:"todo"    },
  { id:"0070", desc:"Sanitize, hand back to ops",      wc:"SAN",    duration:2.0, status:"todo"    },
];

// Reliability — equipment availability heatmap (7d × 24h)
function genHeat() {
  const days = 14, hours = 24;
  const m = [];
  for (let d=0; d<days; d++) {
    const row = [];
    for (let h=0; h<hours; h++) {
      let v = 100;
      // sprinkle downtime
      if (d===2 && h>=9 && h<=12) v = 0;             // 4h dryer outage
      else if (d===5 && h>=14 && h<=16) v = 22;
      else if (d===8 && h>=2  && h<=3)  v = 0;
      else if (d===11 && h>=18 && h<=22) v = 60;
      else if (Math.random() < 0.04) v = 70 + Math.random()*20;
      row.push(Math.round(v));
    }
    m.push(row);
  }
  return m;
}
const AVAIL_HEAT = genHeat();

// Asset profile — Spray Dryer #2
const ASSET_DRY02 = {
  id: "BLT.PRO.DRY.02",
  name: "Spray Dryer #2",
  type: "Multi-stage spray dryer",
  manufacturer: "GEA Niro",
  installed: "2014-08-12",
  service_age_y: 11.7,
  criticality: "A — production-critical",
  parent: "BLT.PRO · Process Hall",
  cost_center: "CC-PRO-200",
  reliability: { availability: 92.4, mtbf: 78, mttr: 5.2, failures_30d: 4 },
  pm_compliance: 78,
  open_orders: 3,
  open_notifs: 2,
  // 12-month vibration trend (placeholder for measuring point)
  vib: [3.2,3.4,3.5,3.3,3.6,3.8,4.0,4.2,4.4,4.7,5.1,5.6,6.2],
  history: [
    { date:"2026-04-28", id:"WO-500810", desc:"Atomizer wheel rebalance", type:"Corrective", h:6.5, cost:2400, fm:"BRG" },
    { date:"2026-04-12", id:"WO-500612", desc:"Quarterly bearing inspection", type:"Preventive", h:3, cost:480, fm:null },
    { date:"2026-03-28", id:"WO-500401", desc:"HEPA filter replacement", type:"Preventive", h:2, cost:1200, fm:null },
    { date:"2026-03-09", id:"WO-500156", desc:"Inlet temp sensor replace", type:"Corrective", h:2, cost:680, fm:"SNS" },
    { date:"2026-02-22", id:"WO-499944", desc:"Powder agglomeration cleanup", type:"Corrective", h:8, cost:3200, fm:"OTH" },
    { date:"2026-02-04", id:"WO-499711", desc:"Annual major service", type:"Preventive", h:18, cost:8400, fm:null },
  ],
};

// Exceptions queue
const EXCEPTIONS = [
  { id:"EXC-031", reason:"Overdue PM > 30d", severity:"High", count:14, owner:"All planners", oldest_d:62, related:"WO-500810…", action:"Reschedule" },
  { id:"EXC-030", reason:"Open notification — no order > 7d", severity:"High", count:9,  owner:"Aoife Brennan", oldest_d:11, related:"NTF-2284836…", action:"Convert to order" },
  { id:"EXC-029", reason:"Order in progress > planned hours", severity:"Medium", count:18, owner:"Marcus Holloway", oldest_d:5, related:"WO-501088…", action:"Re-estimate" },
  { id:"EXC-028", reason:"Repeat failure within 30d", severity:"High", count:6,  owner:"Reliability", oldest_d:14, related:"BLT.PRO.DRY.02", action:"Trigger RCA" },
  { id:"EXC-027", reason:"Critical equipment, no PM in 90d", severity:"High", count:4,  owner:"Priya Iyer", oldest_d:104, related:"BLT.PKG.FIL.04", action:"Schedule PM" },
  { id:"EXC-026", reason:"Stale schedule confirmation > 3d",  severity:"Low",   count:22, owner:"Supervisors", oldest_d:5, related:"WO-501052…", action:"Confirm/close" },
  { id:"EXC-025", reason:"Order missing planner group", severity:"Low", count:11, owner:"Master data", oldest_d:9, related:"WO-500944…", action:"Assign group" },
  { id:"EXC-024", reason:"Breakdown without root-cause coded", severity:"Medium", count:7, owner:"Supervisors", oldest_d:3, related:"NTF-2284782…", action:"Code failure" },
];

// Schedule board (Mon–Sun, 7 work centers)
const SCHED_DAYS = ["Mon 5/4","Tue 5/5","Wed 5/6","Thu 5/7","Fri 5/8","Sat 5/9","Sun 5/10"];
const SCHED_TASKS = {
  "MECH-A": [
    [{wo:"WO-501221", desc:"Bearing R&R · Dryer 2", h:8, prio:"critical"}],
    [{wo:"WO-501221", desc:"Bearing R&R · Dryer 2", h:8, prio:"critical"}, {wo:"WO-500992", desc:"Lube route", h:2, prio:"normal"}],
    [{wo:"WO-501190", desc:"NH3 compressor inspection", h:4, prio:"normal"}],
    [{wo:"WO-501205", desc:"Sterile air filter", h:4, prio:"normal"}],
    [],[],[]
  ],
  "MECH-B": [
    [{wo:"WO-501172", desc:"Drive belt R&R · Mixer 8", h:3, prio:"watch"}, {wo:"WO-500944", desc:"Conveyor idler", h:3, prio:"watch"}],
    [{wo:"WO-500944", desc:"Conveyor idler", h:3, prio:"watch"}],
    [],
    [{wo:"WO-501148", desc:"Capper torque cal.", h:4, prio:"normal"}],
    [],[],[]
  ],
  "ELEC": [
    [{wo:"WO-501218", desc:"Steam regulator · Evap 1", h:6, prio:"watch"}],
    [{wo:"WO-500961", desc:"MCC-4 thermography", h:5, prio:"watch"}],
    [],[],[],[],[]
  ],
  "AUTO": [
    [],
    [{wo:"WO-501148", desc:"Capper torque cal.", h:4, prio:"normal"}],
    [{wo:"WO-500920", desc:"Vib sensors · Dryer 1", h:8, prio:"normal"}],
    [{wo:"WO-500920", desc:"Vib sensors · Dryer 1", h:8, prio:"normal"}],
    [],[],[]
  ],
  "UTIL": [
    [{wo:"WO-501160", desc:"Boiler valve check", h:5, prio:"normal"}],
    [],
    [{wo:"WO-501088", desc:"AHU-06 filter", h:2, prio:"normal"}],
    [],[],[],[]
  ],
};

const SCHED_CENTERS = ["MECH-A","MECH-B","ELEC","AUTO","UTIL"];

window.PMData = {
  PLANTS, WORK_CENTERS, PLANNERS,
  KPI_SUMMARY, SPARKS,
  WORK_MIX, BACKLOG_AGE, BACKLOG_BY_WC,
  BAD_ACTORS, FAILURE_MODES,
  NOTIFICATIONS, ORDERS, OPERATIONS_501221,
  AVAIL_HEAT,
  ASSET_DRY02,
  EXCEPTIONS,
  SCHED_DAYS, SCHED_TASKS, SCHED_CENTERS,
};
