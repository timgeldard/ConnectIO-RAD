# warehouse360 SQL — Phase Roadmap

## Current State: Phase 1 (Views on Raw SAP)

All ten views in `views/` query the raw SAP managed tables directly:

| Schema | Tables used |
|--------|-------------|
| `connected_plant_uat.sap.*` | AFKO, AFPO, LTAK, LTAP, LTBK, LAGP, LQUA, LIKP, LIPS, RESB |
| `published_uat.central_services.*` | EKKO, EKPO, MCHA, VEKP, VEPO |

Phase 1 is intentionally "quick and dirty" — correct results, no latency SLA, no
incremental processing. The view names and column contracts are stable and will not
change between phases. Backend and frontend code does not need to change when Phase 2
is deployed.

---

## Phase 2: Silver + Gold Upgrade Path

When Phase 1 query latency becomes a bottleneck, or when source table cardinality
grows to the point where direct joins are too expensive, swap the view *bodies* to
read from silver/gold-layer tables. View names and output schemas remain identical.

### Silver Layer — 6 DLT Tables

Delta Live Tables pipelines that clean, type-cast, and incrementally maintain raw SAP
data. All SAP date strings are parsed to `DATE` type. Plant filter `WERKS = 'IE01'`
is applied at ingestion time.

| Silver Table | Source SAP Tables | Key transforms |
|---|---|---|
| `wh360_silver_production_orders` | AFKO, AFPO | Parse GSTRP/GLTRP/FTRMS/FTRMI to DATE; join on AUFNR |
| `wh360_silver_warehouse_tasks` | LTAK, LTAP, LTBK | Parse BDATU to DATE; concat src/dst bin; flag open/done |
| `wh360_silver_deliveries` | LIKP, LIPS | Parse WADAT/WADAT_IST/LDDAT/LFDAT to DATE; join on VBELN |
| `wh360_silver_inbound` | EKKO, EKPO, QALS | Parse EINDT/BEDAT to DATE; join PO header+item+QA lot |
| `wh360_silver_bin_stock` | LAGP, LQUA | Parse VFDAT/BDATU to DATE; bin-quant aggregate |
| `wh360_silver_materials` | MARA, MCHA, VEKP, VEPO | Batch and HU master with parsed shelf-life dates |

### Gold Layer — 5 Materialized Views

Materialized views (or DLT Gold tables) that pre-aggregate and pre-classify. These
replace the heavier CTE logic currently in the Phase 1 view bodies.

| Gold Object | Reads From | Adds |
|---|---|---|
| `wh360_gold_process_orders_mv` | `wh360_silver_production_orders`, `wh360_silver_warehouse_tasks` | Pre-computed `staging_pct`, `mins_to_start`, `risk` |
| `wh360_gold_deliveries_mv` | `wh360_silver_deliveries` | Pre-computed `pick_pct`, `mins_to_cutoff`, `risk`, `shipped` |
| `wh360_gold_inbound_mv` | `wh360_silver_inbound` | Pre-computed `open_qty`, `qa_status` |
| `wh360_gold_bin_health_mv` | `wh360_silver_bin_stock` | Pre-computed `fill_pct`, `bin_status`, `days_to_expiry`, `age_days` |
| `wh360_gold_kpi_daily_mv` | All gold MVs above | Single-row KPI snapshot, refreshed on schedule |

### Unity Catalog Metric Views — 4 Metrics

UC metric views enable AI/BI dashboard integration and alerting via Databricks Genie.

| Metric View | Formula | Business meaning |
|---|---|---|
| `metric_wh360_staging_sla` | % of orders reaching `staging_pct >= 70` before `mins_to_start = 0` | Staging on-time rate |
| `metric_wh360_otif` | % of deliveries with `pick_pct = 100` on or before `planned_gi_date` | On-Time In-Full |
| `metric_wh360_putaway_cycle` | Median `age_days` of quants in bulk storage (LGTYP not in lineside types) | Putaway cycle time |
| `metric_wh360_pick_productivity` | TO items confirmed per hour per operator (LTAK.BNAME + BZEIT) | Pick throughput |

---

## Migration Checklist (Phase 1 → Phase 2)

1. Deploy DLT pipeline for the 6 silver tables. Validate row counts and date parsing
   against Phase 1 view output.
2. Deploy the 5 gold materialized views. Run parallel query against Phase 1 views and
   gold MVs; assert KPI values match within tolerance.
3. Swap Phase 1 view bodies to read from gold layer. Keep `CREATE OR REPLACE VIEW`
   headers identical.
4. Run backend integration tests (no schema changes expected).
5. Decommission direct SAP table access from the `wh360` schema.

---

## Notes

- Phase 1 view bodies target raw SAP tables, which are outside the project-wide
  "gold-only" query rule. This is intentional for the bootstrap phase. Phase 2
  restores compliance by routing all queries through silver/gold objects.
- The `connected_plant_uat.wh360` schema must exist and the service principal running
  the app must have `USE SCHEMA`, `SELECT` grants on all source schemas, plus
  `CREATE VIEW` on `wh360`.
- All views are idempotent (`CREATE OR REPLACE`). Run them in any order; they have no
  inter-view dependencies at the SQL level.
