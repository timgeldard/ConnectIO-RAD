# Glossary

When a user uses any of these terms, apply the definition below.

## Core Terms

**Process Order** — An SAP production order (also called manufacturing order or work order).
Identified by PROCESS_ORDER_ID (12-character SAP string). Never cast to integer.
Synonyms: order, aufnr, production order, PO.

**Material** — A product, raw material, intermediate, or packaging item.
Identified by MATERIAL_ID (18-character SAP string with leading zeros). Never cast to integer.
Synonyms: product, SKU, item, matnr.

**Pour** — A movement of component material into an active process order during production.
Corresponds to SAP movement type 261 in `vw_gold_adp_movement`. A pour has a quantity (in KG or L),
a timestamp (DATE_TIME_OF_ENTRY), and is linked to a PROCESS_ORDER_ID.
Reversals of pours are movement type 262 — exclude them unless the user specifically asks.

**Plant** — A manufacturing site identified by a 4-character SAP code (e.g. LND1, RCN1).
The PLANT_ID column appears on most tables.

**Schedule Adherence** — Whether a completed order finished on or before its planned end date
(IS_ON_TIME) and delivered at least 95% of the planned quantity (IS_IN_FULL).
OTIF = both on time AND in full.

**OEE** — Overall Equipment Effectiveness = Availability × Performance × Quality.
Expressed as a percentage (0–100). Pre-calculated in `metric_oee_daily` per line per day.
Never re-derive OEE from components — use OEE_PCT directly.

**Yield** — Ratio of actual goods receipt quantity (movement type 101) to the planned
order quantity from `vw_gold_process_order`. Expressed as a percentage.

**Vessel** — Equipment used for production: tanks, bioreactors, skids, scales.
Tracked in `vw_gold_instrument` (master) and `vw_gold_equipment_history` (state changes).

**MIC** — Master Inspection Characteristic: a quality test or measurement (e.g. moisture %, pH).
Referenced in confirmation data.

**Goods Receipt (GR)** — Production output being received into inventory. SAP movement type 101.
Reversal = movement type 102.

**OTIF** — On Time In Full. IS_OTIF = TRUE in metric_schedule_adherence.

## SAP Status Codes in vw_gold_process_order

| Raw STATUS value | Business meaning |
|---|---|
| IN PROGRESS | Order is running / in production |
| Tulip Load In Progress | Order is running (Tulip system) |
| COMPLETED | Order finished — final confirmation posted |
| CLOSED | Order administratively closed |
| ON HOLD | Order paused / blocked |
| CANCELLED | Order cancelled — exclude from KPIs |
| (anything else) | Released — scheduled but not yet started |

## Movement Types in vw_gold_adp_movement

| MOVEMENT_TYPE | Meaning |
|---|---|
| 101 | Goods receipt — production output (use for yield) |
| 102 | Reversal of 101 |
| 261 | Component issue — pour (use for pour analytics) |
| 262 | Reversal of 261 |
