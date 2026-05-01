# Business Context

This Genie Space covers manufacturing operations for Kerry Group food production plants.
It answers questions about process orders, production pours, schedule adherence, OEE,
yield, vessel planning, and equipment master data.

## Scope

- **Process orders**: SAP production/process orders from plant creation through completion.
  Each order produces a material (product) on a production line.
- **Pours**: Component material issues into an active process order. A pour represents
  actual raw material consumption during production (SAP movement type 261).
- **Schedule adherence**: Whether completed orders finished on time and in full
  versus the planned completion date and planned quantity.
- **OEE**: Daily Overall Equipment Effectiveness per production line — pre-calculated
  as Availability × Performance × Quality.
- **Yield**: Ratio of actual goods receipt quantity to planned order quantity.
- **Vessel planning**: Heuristic recommendations for which vessel (tank, bioreactor, scale)
  to assign to an upcoming process order, based on equipment state history and material affinity.
- **Equipment master**: The instrument/equipment registry for the plant — types, counts,
  and sub-type distribution.

## Data Freshness

Gold-layer views reflect the most recent pipeline run. Typical latency from SAP
is a few hours. Do not present data as real-time or live.

## Plants and Sites

Plants are identified by a 4-character SAP plant code (e.g. LND1, RCN1).
Use PLANT_ID to filter by site. Plant names are not stored in these views —
refer to the plant code directly.

## What This Space Does Not Cover

- Batch traceability (forward/reverse trace) — that data is in the Trace2 app.
- Detailed SPC control chart data — that is in the SPC app.
- Scale verification results (Tulip) — requires a Unity Catalogue view that does not yet exist.
  Do not attempt to query `scale_verification_results`.
