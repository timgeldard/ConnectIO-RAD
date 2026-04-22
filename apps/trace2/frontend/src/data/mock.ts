// Mock data for Meridian Ingredients batch traceability
// Fictional F&B ingredients manufacturer — recreated from schema of provided dashboard JSON.

import type {
  Batch,
  BatchCompareEntry,
  CountryRow,
  CustomerRow,
  Delivery,
  ExposureRow,
  InspectionLot,
  Lineage,
  MassBalanceEvent,
  MIC,
  ProductionEntry,
  RecallEvent,
  Supplier,
} from "../types";

export const BATCH: Batch = {
  material_id: "20582002",
  material_name: "Natural Vanilla Extract, Double-Fold, Madagascar",
  material_desc40: "Nat. Vanilla Ext. 2X Madagascar",
  batch_id: "0009989623",
  process_order: "PO-4418772",
  plant_id: "DE-BRE-01",
  plant_name: "Bremen Flavor House",
  manufacture_date: "14-Mar-2026",
  expiry_date: "14-Mar-2028",
  days_to_expiry: 693,
  shelf_life_status: "WITHIN_SHELF_LIFE",
  batch_status: "UNRESTRICTED",
  uom: "KG",
  qty_produced: 4820.4,
  qty_shipped: 3168.2,
  qty_consumed: 412.0,
  qty_adjusted: -18.6,
  current_stock: 1221.6,
  variance: 0.0,
  mass_balance_kg: 4820.4,
  unrestricted: 1221.6,
  blocked: 0,
  qi: 0,
  transit: 0,
  restricted: 0,
  customers_affected: 14,
  countries_affected: 9,
  total_shipped_kg: 3168.2,
  total_deliveries: 27,
  total_consumed: 412.0,
  consuming_pos: 3,
};

export const BATCH_FAIL: Batch = {
  ...BATCH,
  batch_id: "0009989624",
  batch_status: "QUALITY_INSPECTION",
  qi: 1820.0,
  unrestricted: 0,
  qty_shipped: 0,
  total_shipped_kg: 0,
  total_deliveries: 0,
};

export const BATCH_RECALL: Batch = {
  ...BATCH,
  batch_id: "0009989622",
  batch_status: "BLOCKED",
  blocked: 820.0,
  unrestricted: 0,
  mass_balance_kg: 4012.0,
  qty_shipped: 3192.0,
};

export const COUNTRIES: CountryRow[] = [
  { code: "US", name: "United States", qty: 842.4, deliveries: 7 },
  { code: "DE", name: "Germany", qty: 612.0, deliveries: 5 },
  { code: "FR", name: "France", qty: 410.6, deliveries: 4 },
  { code: "GB", name: "United Kingdom", qty: 388.2, deliveries: 3 },
  { code: "NL", name: "Netherlands", qty: 294.0, deliveries: 2 },
  { code: "IT", name: "Italy", qty: 218.0, deliveries: 2 },
  { code: "CA", name: "Canada", qty: 180.0, deliveries: 2 },
  { code: "JP", name: "Japan", qty: 132.0, deliveries: 1 },
  { code: "AU", name: "Australia", qty: 91.0, deliveries: 1 },
];

export const CUSTOMERS: CustomerRow[] = [
  { id: "C-10442", name: "Northfield Confections", country: "US", qty: 612.0, deliveries: 5, share: 0.193 },
  { id: "C-10518", name: "Linden & Faust Bäckerei", country: "DE", qty: 480.0, deliveries: 4, share: 0.151 },
  { id: "C-10611", name: "Maison Caramel", country: "FR", qty: 326.0, deliveries: 3, share: 0.103 },
  { id: "C-10203", name: "Cromwell Dairy Co.", country: "GB", qty: 294.0, deliveries: 2, share: 0.093 },
  { id: "C-10789", name: "Rotterdam Gelato Works", country: "NL", qty: 262.0, deliveries: 2, share: 0.083 },
  { id: "C-10881", name: "Torino Dolci S.p.A.", country: "IT", qty: 218.0, deliveries: 2, share: 0.069 },
  { id: "C-10114", name: "Great Lakes Bakers Guild", country: "US", qty: 196.0, deliveries: 2, share: 0.062 },
  { id: "C-10920", name: "Montreal Patisserie Co-op", country: "CA", qty: 180.0, deliveries: 2, share: 0.057 },
  { id: "C-10055", name: "Aurelia Premium Foods", country: "US", qty: 164.0, deliveries: 2, share: 0.052 },
  { id: "C-10771", name: "Shibuya Confiserie", country: "JP", qty: 132.0, deliveries: 1, share: 0.042 },
  { id: "C-10412", name: "Westbrook Ice Cream Ltd", country: "GB", qty: 94.0, deliveries: 1, share: 0.030 },
  { id: "C-10333", name: "Meridian Harvest Direct", country: "AU", qty: 91.0, deliveries: 1, share: 0.029 },
  { id: "C-10277", name: "Kastor Bakeries A/S", country: "DE", qty: 73.2, deliveries: 1, share: 0.023 },
  { id: "C-10199", name: "Brun & Fils Chocolatiers", country: "FR", qty: 84.0, deliveries: 1, share: 0.027 },
];

export const DELIVERIES: Delivery[] = [
  { delivery: "DEL-5540118", customer: "Northfield Confections", destination: "Chicago, IL", country: "US", date: "21-Mar-2026", qty: 140.0, status: "DELIVERED", doc: "80-102288" },
  { delivery: "DEL-5540122", customer: "Linden & Faust Bäckerei", destination: "Hamburg", country: "DE", date: "22-Mar-2026", qty: 120.0, status: "DELIVERED", doc: "80-102291" },
  { delivery: "DEL-5540131", customer: "Maison Caramel", destination: "Lyon", country: "FR", date: "23-Mar-2026", qty: 108.0, status: "DELIVERED", doc: "80-102299" },
  { delivery: "DEL-5540140", customer: "Cromwell Dairy Co.", destination: "Manchester", country: "GB", date: "24-Mar-2026", qty: 98.0, status: "DELIVERED", doc: "80-102304" },
  { delivery: "DEL-5540155", customer: "Rotterdam Gelato Works", destination: "Rotterdam", country: "NL", date: "24-Mar-2026", qty: 131.0, status: "DELIVERED", doc: "80-102310" },
  { delivery: "DEL-5540168", customer: "Torino Dolci S.p.A.", destination: "Torino", country: "IT", date: "25-Mar-2026", qty: 109.0, status: "DELIVERED", doc: "80-102315" },
  { delivery: "DEL-5540182", customer: "Northfield Confections", destination: "Chicago, IL", country: "US", date: "27-Mar-2026", qty: 124.0, status: "DELIVERED", doc: "80-102322" },
  { delivery: "DEL-5540199", customer: "Great Lakes Bakers Guild", destination: "Milwaukee, WI", country: "US", date: "28-Mar-2026", qty: 98.0, status: "DELIVERED", doc: "80-102329" },
  { delivery: "DEL-5540211", customer: "Shibuya Confiserie", destination: "Tokyo", country: "JP", date: "30-Mar-2026", qty: 132.0, status: "DELIVERED", doc: "80-102338" },
  { delivery: "DEL-5540226", customer: "Montreal Patisserie Co-op", destination: "Montreal, QC", country: "CA", date: "01-Apr-2026", qty: 90.0, status: "DELIVERED", doc: "80-102344" },
  { delivery: "DEL-5540238", customer: "Aurelia Premium Foods", destination: "Boston, MA", country: "US", date: "02-Apr-2026", qty: 82.0, status: "DELIVERED", doc: "80-102351" },
  { delivery: "DEL-5540251", customer: "Brun & Fils Chocolatiers", destination: "Paris", country: "FR", date: "03-Apr-2026", qty: 84.0, status: "DELIVERED", doc: "80-102358" },
  { delivery: "DEL-5540268", customer: "Westbrook Ice Cream Ltd", destination: "Bristol", country: "GB", date: "05-Apr-2026", qty: 94.0, status: "DELIVERED", doc: "80-102366" },
  { delivery: "DEL-5540277", customer: "Meridian Harvest Direct", destination: "Melbourne", country: "AU", date: "07-Apr-2026", qty: 91.0, status: "IN_TRANSIT", doc: "80-102372" },
  { delivery: "DEL-5540284", customer: "Linden & Faust Bäckerei", destination: "Munich", country: "DE", date: "09-Apr-2026", qty: 116.0, status: "DELIVERED", doc: "80-102379" },
  { delivery: "DEL-5540299", customer: "Kastor Bakeries A/S", destination: "Berlin", country: "DE", date: "10-Apr-2026", qty: 73.2, status: "DELIVERED", doc: "80-102385" },
  { delivery: "DEL-5540311", customer: "Maison Caramel", destination: "Bordeaux", country: "FR", date: "11-Apr-2026", qty: 112.0, status: "DELIVERED", doc: "80-102392" },
  { delivery: "DEL-5540324", customer: "Cromwell Dairy Co.", destination: "Glasgow", country: "GB", date: "12-Apr-2026", qty: 100.0, status: "DELIVERED", doc: "80-102398" },
  { delivery: "DEL-5540338", customer: "Rotterdam Gelato Works", destination: "Amsterdam", country: "NL", date: "13-Apr-2026", qty: 131.0, status: "DELIVERED", doc: "80-102405" },
  { delivery: "DEL-5540342", customer: "Maison Caramel", destination: "Marseille", country: "FR", date: "14-Apr-2026", qty: 106.0, status: "DELIVERED", doc: "80-102411" },
  { delivery: "DEL-5540359", customer: "Linden & Faust Bäckerei", destination: "Frankfurt", country: "DE", date: "15-Apr-2026", qty: 124.0, status: "DELIVERED", doc: "80-102418" },
  { delivery: "DEL-5540368", customer: "Northfield Confections", destination: "Atlanta, GA", country: "US", date: "16-Apr-2026", qty: 144.0, status: "DELIVERED", doc: "80-102425" },
  { delivery: "DEL-5540377", customer: "Torino Dolci S.p.A.", destination: "Milano", country: "IT", date: "17-Apr-2026", qty: 109.0, status: "DELIVERED", doc: "80-102431" },
  { delivery: "DEL-5540388", customer: "Great Lakes Bakers Guild", destination: "Detroit, MI", country: "US", date: "18-Apr-2026", qty: 98.0, status: "DELIVERED", doc: "80-102438" },
  { delivery: "DEL-5540399", customer: "Aurelia Premium Foods", destination: "New York, NY", country: "US", date: "19-Apr-2026", qty: 82.0, status: "IN_TRANSIT", doc: "80-102442" },
  { delivery: "DEL-5540411", customer: "Linden & Faust Bäckerei", destination: "Stuttgart", country: "DE", date: "20-Apr-2026", qty: 120.0, status: "PLANNED", doc: "80-102450" },
  { delivery: "DEL-5540422", customer: "Northfield Confections", destination: "Houston, TX", country: "US", date: "21-Apr-2026", qty: 124.0, status: "PLANNED", doc: "80-102457" },
];

export const LINEAGE: Lineage = {
  focal: {
    id: "F",
    material_id: "20582002",
    material: "Nat. Vanilla Ext. 2X Madagascar",
    batch_id: "0009989623",
    plant: "DE-BRE-01 Bremen Flavor House",
    qty: 4820.4,
    uom: "KG",
    kind: "focal",
  },
  upstream: [
    { id: "U1", level: 1, material_id: "30012005", material: "Vanilla Bean, Madagascar Grade A", batch: "MG-24-1180", plant: "SN-TNR Antananarivo Depot", qty: 612.0, uom: "KG", supplier: "Ambatondrazaka Cooperative", link: "RECEIPT", parent: "F" },
    { id: "U2", level: 1, material_id: "30012005", material: "Vanilla Bean, Madagascar Grade A", batch: "MG-24-1214", plant: "SN-TNR Antananarivo Depot", qty: 488.0, uom: "KG", supplier: "Mananara Union", link: "RECEIPT", parent: "F" },
    { id: "U3", level: 1, material_id: "40018811", material: "Food-grade Ethanol 95%", batch: "ET-26-0224", plant: "NL-RTM Rotterdam Terminal", qty: 1840.0, uom: "KG", supplier: "Polaris Alcohols BV", link: "RECEIPT", parent: "F" },
    { id: "U4", level: 1, material_id: "40019002", material: "Sugar, Refined Beet", batch: "SB-26-3310", plant: "DE-MAG Magdeburg Silo", qty: 1220.0, uom: "KG", supplier: "Nordzucker Konsortium", link: "RECEIPT", parent: "F" },
    { id: "U5", level: 1, material_id: "50011042", material: "Purified Process Water", batch: "PW-26-W12", plant: "DE-BRE-01 Bremen Flavor House", qty: 660.4, uom: "KG", supplier: "(internal)", link: "INTERNAL", parent: "F" },
    { id: "U1a", level: 2, material_id: "30012004", material: "Green Vanilla Pods", batch: "FM-24-8801", plant: "Farm Coop 04 Antalaha", qty: 820.0, uom: "KG", supplier: "Antalaha Smallholder Pool", link: "RECEIPT", parent: "U1" },
    { id: "U2a", level: 2, material_id: "30012004", material: "Green Vanilla Pods", batch: "FM-24-8842", plant: "Farm Coop 07 Sambava", qty: 655.0, uom: "KG", supplier: "Sambava Growers Alliance", link: "RECEIPT", parent: "U2" },
    { id: "U4a", level: 2, material_id: "40019001", material: "Sugar Beet (raw)", batch: "RB-25-0919", plant: "DE-MAG Magdeburg Silo", qty: 6100.0, uom: "KG", supplier: "Uckermark Farmers GmbH", link: "RECEIPT", parent: "U4" },
  ],
  downstream: [
    { id: "D1", level: 1, material_id: "28001120", material: "Vanilla-Caramel Flavor System", batch: "VC-26-4401", plant: "DE-BRE-02 Bremen Blend Plant", qty: 1820.0, uom: "KG", customer: "(internal transfer)", link: "CONSUMPTION", parent: "F" },
    { id: "D2", level: 1, material_id: "28001208", material: "Premium Vanilla Ice-Cream Base", batch: "VB-26-0312", plant: "NL-RTM Rotterdam Blend", qty: 820.0, uom: "KG", customer: "Rotterdam Gelato Works", link: "SALES_ORDER", parent: "F" },
    { id: "D3", level: 1, material_id: "28001340", material: "Madagascar Vanilla Syrup", batch: "MS-26-0188", plant: "US-ATL Atlanta Mix Center", qty: 528.0, uom: "KG", customer: "Northfield Confections", link: "SALES_ORDER", parent: "F" },
    { id: "D1a", level: 2, material_id: "19002011", material: "Caramel Confection Base KG-22", batch: "KG-26-0477", plant: "DE-STG Stuttgart Finishing", qty: 820.0, uom: "KG", customer: "Linden & Faust Bäckerei", link: "SALES_ORDER", parent: "D1" },
    { id: "D1b", level: 2, material_id: "19002011", material: "Caramel Confection Base KG-22", batch: "KG-26-0482", plant: "DE-STG Stuttgart Finishing", qty: 680.0, uom: "KG", customer: "Kastor Bakeries A/S", link: "SALES_ORDER", parent: "D1" },
    { id: "D2a", level: 2, material_id: "19002208", material: "Gelato Mix, Premium Vanilla", batch: "GM-26-0033", plant: "IT-TRN Torino Plant", qty: 620.0, uom: "KG", customer: "Torino Dolci S.p.A.", link: "SALES_ORDER", parent: "D2" },
    { id: "D3a", level: 2, material_id: "19002340", material: "Bakery Syrup, Vanilla 1qt", batch: "BS-26-0221", plant: "US-ATL Atlanta Mix Center", qty: 210.0, uom: "KG", customer: "Great Lakes Bakers Guild", link: "SALES_ORDER", parent: "D3" },
    { id: "D3b", level: 2, material_id: "19002340", material: "Bakery Syrup, Vanilla 1qt", batch: "BS-26-0224", plant: "US-ATL Atlanta Mix Center", qty: 318.0, uom: "KG", customer: "Aurelia Premium Foods", link: "SALES_ORDER", parent: "D3" },
  ],
};

export const MASS_BALANCE: MassBalanceEvent[] = [
  { date: "14-Mar", event: "GR Production (101)", delta: +4820.4, cum: 4820.4 },
  { date: "15-Mar", event: "Quality release (321)", delta: 0.0, cum: 4820.4 },
  { date: "16-Mar", event: "Consumption (261)", delta: -180.0, cum: 4640.4 },
  { date: "18-Mar", event: "Consumption (261)", delta: -232.0, cum: 4408.4 },
  { date: "21-Mar", event: "Sales issue (601)", delta: -140.0, cum: 4268.4 },
  { date: "22-Mar", event: "Sales issue (601)", delta: -120.0, cum: 4148.4 },
  { date: "24-Mar", event: "Sales issue (601)", delta: -229.0, cum: 3919.4 },
  { date: "27-Mar", event: "Sales issue (601)", delta: -222.0, cum: 3697.4 },
  { date: "30-Mar", event: "Sales issue (601)", delta: -132.0, cum: 3565.4 },
  { date: "01-Apr", event: "Physical adj (701)", delta: -18.6, cum: 3546.8 },
  { date: "03-Apr", event: "Sales issue (601)", delta: -166.0, cum: 3380.8 },
  { date: "05-Apr", event: "Sales issue (601)", delta: -94.0, cum: 3286.8 },
  { date: "09-Apr", event: "Sales issue (601)", delta: -189.2, cum: 3097.6 },
  { date: "12-Apr", event: "Sales issue (601)", delta: -231.0, cum: 2866.6 },
  { date: "14-Apr", event: "Sales issue (601)", delta: -218.0, cum: 2648.6 },
  { date: "17-Apr", event: "Sales issue (601)", delta: -207.0, cum: 2441.6 },
  { date: "19-Apr", event: "Sales issue (601)", delta: -226.0, cum: 2215.6 },
  { date: "21-Apr", event: "Current", delta: -994.0, cum: 1221.6 },
];

export const INSPECTION_LOTS: InspectionLot[] = [
  { lot: "080004418772", type: "01 / Goods receipt", start: "14-Mar-2026", end: "15-Mar-2026", qty: 4820.4, uom: "KG", decision: "ACCEPTED", insp_by: "Dr. H. Vogel", origin: "Production" },
  { lot: "080004418773", type: "04 / Stability", start: "14-Mar-2026", end: "14-Mar-2026", qty: 12.0, uom: "KG", decision: "ACCEPTED", insp_by: "Dr. H. Vogel", origin: "Stability" },
  { lot: "080004418774", type: "08 / Recurring", start: "01-Apr-2026", end: "02-Apr-2026", qty: 8.0, uom: "KG", decision: "ACCEPTED", insp_by: "L. Okonkwo", origin: "Recurring QC" },
];

export const MICS: MIC[] = [
  { id: "MIC-VAN-001", name: "Vanillin content", target: "≥ 4.0%", tol: "±0.2%", uom: "% w/w", value: "4.21", qual: "", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-002", name: "Ethanol content", target: "55.0%", tol: "±1.0%", uom: "% v/v", value: "54.8", qual: "", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-003", name: "Moisture", target: "≤ 45.0%", tol: "", uom: "% w/w", value: "41.2", qual: "", result: "ACCEPTED", critical: false },
  { id: "MIC-VAN-004", name: "Appearance", target: "Clear, dark amber", tol: "", uom: "", value: "", qual: "Pass", result: "ACCEPTED", critical: false },
  { id: "MIC-VAN-005", name: "Specific gravity (20°C)", target: "1.05", tol: "±0.02", uom: "g/mL", value: "1.048", qual: "", result: "ACCEPTED", critical: false },
  { id: "MIC-VAN-006", name: "Total plate count", target: "≤ 100", tol: "", uom: "CFU/g", value: "< 10", qual: "", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-007", name: "Yeast & mould", target: "≤ 50", tol: "", uom: "CFU/g", value: "< 10", qual: "", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-008", name: "Coliforms", target: "Absent /g", tol: "", uom: "", value: "", qual: "Absent", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-009", name: "Salmonella /25g", target: "Absent", tol: "", uom: "", value: "", qual: "Absent", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-010", name: "Pb (lead)", target: "≤ 0.10", tol: "", uom: "mg/kg", value: "0.02", qual: "", result: "ACCEPTED", critical: false },
  { id: "MIC-VAN-011", name: "As (arsenic)", target: "≤ 0.10", tol: "", uom: "mg/kg", value: "< 0.01", qual: "", result: "ACCEPTED", critical: false },
  { id: "MIC-VAN-012", name: "Pesticide residue (GC-MS)", target: "< LOQ", tol: "", uom: "", value: "", qual: "Pass", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-013", name: "Allergen screen (dairy)", target: "Absent", tol: "", uom: "", value: "", qual: "Absent", result: "ACCEPTED", critical: true },
  { id: "MIC-VAN-014", name: "Gluten", target: "< 10", tol: "", uom: "mg/kg", value: "< 5", qual: "", result: "ACCEPTED", critical: false },
  { id: "MIC-VAN-015", name: "Sensory panel score", target: "≥ 8 / 10", tol: "", uom: "score", value: "8.6", qual: "", result: "ACCEPTED", critical: false },
];

export const PRODUCTION_HISTORY: ProductionEntry[] = [
  { batch: "0009988402", po: "PO-4418001", plant: "DE-BRE-01", date: "03-Oct-2025", qty: 4760, status: "RELEASED", yield_pct: 98.2 },
  { batch: "0009988611", po: "PO-4418102", plant: "DE-BRE-01", date: "29-Oct-2025", qty: 4812, status: "RELEASED", yield_pct: 99.1 },
  { batch: "0009988822", po: "PO-4418210", plant: "DE-BRE-01", date: "18-Nov-2025", qty: 4690, status: "RELEASED", yield_pct: 96.6 },
  { batch: "0009989014", po: "PO-4418318", plant: "DE-BRE-01", date: "08-Dec-2025", qty: 4830, status: "RELEASED", yield_pct: 99.4 },
  { batch: "0009989221", po: "PO-4418440", plant: "DE-BRE-01", date: "05-Jan-2026", qty: 4888, status: "RELEASED", yield_pct: 100.6 },
  { batch: "0009989401", po: "PO-4418560", plant: "DE-BRE-01", date: "03-Feb-2026", qty: 4720, status: "RELEASED", yield_pct: 97.2 },
  { batch: "0009989510", po: "PO-4418640", plant: "DE-BRE-01", date: "20-Feb-2026", qty: 4690, status: "RELEASED", yield_pct: 96.6 },
  { batch: "0009989601", po: "PO-4418710", plant: "DE-BRE-01", date: "03-Mar-2026", qty: 4840, status: "RELEASED", yield_pct: 99.7 },
  { batch: "0009989622", po: "PO-4418760", plant: "DE-BRE-01", date: "11-Mar-2026", qty: 4012, status: "BLOCKED", yield_pct: 82.6 },
  { batch: "0009989623", po: "PO-4418772", plant: "DE-BRE-01", date: "14-Mar-2026", qty: 4820, status: "RELEASED", yield_pct: 99.3 },
  { batch: "0009989624", po: "PO-4418791", plant: "DE-BRE-01", date: "21-Mar-2026", qty: 4680, status: "Q_INSP", yield_pct: 96.4 },
  { batch: "0009989711", po: "PO-4418821", plant: "DE-BRE-01", date: "02-Apr-2026", qty: 4790, status: "RELEASED", yield_pct: 98.7 },
  { batch: "0009989820", po: "PO-4418910", plant: "DE-BRE-01", date: "17-Apr-2026", qty: 4820, status: "IN_PROC", yield_pct: 99.3 },
];

export const SUPPLIERS: Supplier[] = [
  { id: "V-40122", name: "Ambatondrazaka Cooperative", country: "MG", material: "Vanilla Bean Grade A", received: 4840, batches: 12, first: "02-Jan-2024", last: "10-Mar-2026", failure_rate: 0.00, risk: "LOW" },
  { id: "V-40138", name: "Mananara Union", country: "MG", material: "Vanilla Bean Grade A", received: 3920, batches: 11, first: "14-Mar-2024", last: "08-Mar-2026", failure_rate: 0.04, risk: "LOW" },
  { id: "V-40211", name: "Sambava Growers Alliance", country: "MG", material: "Green Vanilla Pods", received: 1820, batches: 7, first: "05-Jun-2024", last: "02-Mar-2026", failure_rate: 0.14, risk: "MEDIUM" },
  { id: "V-40240", name: "Antalaha Smallholder Pool", country: "MG", material: "Green Vanilla Pods", received: 2410, batches: 9, first: "11-Apr-2024", last: "09-Mar-2026", failure_rate: 0.00, risk: "LOW" },
  { id: "V-40318", name: "Polaris Alcohols BV", country: "NL", material: "Food-grade Ethanol", received: 14820, batches: 22, first: "02-Jan-2022", last: "16-Mar-2026", failure_rate: 0.00, risk: "LOW" },
  { id: "V-40401", name: "Nordzucker Konsortium", country: "DE", material: "Sugar Refined Beet", received: 9880, batches: 18, first: "02-Jan-2022", last: "15-Mar-2026", failure_rate: 0.00, risk: "LOW" },
  { id: "V-40420", name: "Uckermark Farmers GmbH", country: "DE", material: "Sugar Beet (raw)", received: 28200, batches: 31, first: "02-Jan-2022", last: "10-Mar-2026", failure_rate: 0.03, risk: "LOW" },
  { id: "V-40511", name: "Oriental Spice Traders", country: "IN", material: "Spice Extracts", received: 810, batches: 5, first: "18-Jun-2024", last: "22-Feb-2026", failure_rate: 0.40, risk: "HIGH" },
];

export const EXPOSURE: ExposureRow[] = [
  { material_id: "28001120", material: "Vanilla-Caramel Flavor System", batch: "VC-26-4401", plant: "DE-BRE-02", qty: 1820, stock: 412, shipped: 1408, status: "UNRESTRICTED", path_depth: 1, risk: "CRITICAL" },
  { material_id: "19002011", material: "Caramel Confection Base KG-22", batch: "KG-26-0477", plant: "DE-STG", qty: 820, stock: 0, shipped: 820, status: "UNRESTRICTED", path_depth: 2, risk: "HIGH" },
  { material_id: "19002011", material: "Caramel Confection Base KG-22", batch: "KG-26-0482", plant: "DE-STG", qty: 680, stock: 120, shipped: 560, status: "UNRESTRICTED", path_depth: 2, risk: "HIGH" },
  { material_id: "28001208", material: "Premium Vanilla Ice-Cream Base", batch: "VB-26-0312", plant: "NL-RTM", qty: 820, stock: 0, shipped: 820, status: "UNRESTRICTED", path_depth: 1, risk: "CRITICAL" },
  { material_id: "19002208", material: "Gelato Mix, Premium Vanilla", batch: "GM-26-0033", plant: "IT-TRN", qty: 620, stock: 0, shipped: 620, status: "UNRESTRICTED", path_depth: 2, risk: "HIGH" },
  { material_id: "28001340", material: "Madagascar Vanilla Syrup", batch: "MS-26-0188", plant: "US-ATL", qty: 528, stock: 108, shipped: 420, status: "UNRESTRICTED", path_depth: 1, risk: "CRITICAL" },
  { material_id: "19002340", material: "Bakery Syrup, Vanilla 1qt", batch: "BS-26-0221", plant: "US-ATL", qty: 210, stock: 40, shipped: 170, status: "UNRESTRICTED", path_depth: 2, risk: "MEDIUM" },
  { material_id: "19002340", material: "Bakery Syrup, Vanilla 1qt", batch: "BS-26-0224", plant: "US-ATL", qty: 318, stock: 120, shipped: 198, status: "UNRESTRICTED", path_depth: 2, risk: "MEDIUM" },
];

const COMPARE_ACCEPTED = [48, 47, 46, 48, 49, 47, 46, 48, 38, 48, 47, 48, 0];
const COMPARE_REJECTED = [0, 0, 0, 0, 0, 0, 1, 0, 10, 0, 1, 0, 0];
const COMPARE_FAILED_MICS = [0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 1, 0, 0];

export const BATCH_COMPARE: BatchCompareEntry[] = PRODUCTION_HISTORY.map((b, i) => ({
  ...b,
  lot_count: 3,
  accepted: COMPARE_ACCEPTED[i],
  rejected: COMPARE_REJECTED[i],
  failed_mics: COMPARE_FAILED_MICS[i],
}));

export const RECALL_EVENTS: RecallEvent[] = [
  { date: "14-Mar-2026", category: "PRODUCTION", type: "101", plant: "DE-BRE-01", qty: +4820.4, uom: "KG", customer: null, country: null, doc: "80-098110" },
  { date: "16-Mar-2026", category: "CONSUMPTION", type: "261", plant: "DE-BRE-02", qty: -180.0, uom: "KG", customer: null, country: null, doc: "80-098188" },
  { date: "18-Mar-2026", category: "CONSUMPTION", type: "261", plant: "DE-BRE-02", qty: -232.0, uom: "KG", customer: null, country: null, doc: "80-098244" },
  { date: "21-Mar-2026", category: "SALES_ISSUE", type: "601", plant: "DE-BRE-01", qty: -140.0, uom: "KG", customer: "Northfield Confections", country: "US", doc: "80-102288" },
  { date: "22-Mar-2026", category: "SALES_ISSUE", type: "601", plant: "DE-BRE-01", qty: -120.0, uom: "KG", customer: "Linden & Faust Bäckerei", country: "DE", doc: "80-102291" },
  { date: "23-Mar-2026", category: "SALES_ISSUE", type: "601", plant: "DE-BRE-01", qty: -108.0, uom: "KG", customer: "Maison Caramel", country: "FR", doc: "80-102299" },
  { date: "24-Mar-2026", category: "SALES_ISSUE", type: "601", plant: "DE-BRE-01", qty: -229.0, uom: "KG", customer: "Multi (NL, GB)", country: "—", doc: "80-102304" },
  { date: "27-Mar-2026", category: "SALES_ISSUE", type: "601", plant: "DE-BRE-01", qty: -222.0, uom: "KG", customer: "Multi (US)", country: "US", doc: "80-102322" },
  { date: "30-Mar-2026", category: "SALES_ISSUE", type: "601", plant: "DE-BRE-01", qty: -132.0, uom: "KG", customer: "Shibuya Confiserie", country: "JP", doc: "80-102338" },
  { date: "01-Apr-2026", category: "ADJUSTMENT", type: "701", plant: "DE-BRE-01", qty: -18.6, uom: "KG", customer: null, country: null, doc: "80-099102" },
];
