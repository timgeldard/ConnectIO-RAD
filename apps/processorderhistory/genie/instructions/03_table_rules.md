# Table-Specific Rules

## vw_gold_process_order

- Primary key: PROCESS_ORDER_ID (STRING, 12-char SAP format — never cast to integer)
- Key columns: PROCESS_ORDER_ID, MATERIAL_ID, PLANT_ID, STATUS, START_TIMESTAMP,
  END_TIMESTAMP, QUANTITY (planned), UOM, INSPECTION_LOT_ID
- QUANTITY is the **planned/scheduled** output quantity for the order
- START_TIMESTAMP and END_TIMESTAMP are TIMESTAMP columns (UTC)
- Always exclude CANCELLED orders from KPI calculations: `WHERE STATUS != 'CANCELLED'`
- For "open" or "active" orders filter: `STATUS IN ('IN PROGRESS', 'Tulip Load In Progress')`
- For "completed" orders filter: `STATUS IN ('COMPLETED', 'CLOSED')`

## vw_gold_adp_movement

- Grain: one row per goods movement document line
- Key columns: PROCESS_ORDER_ID, MATERIAL_ID, QUANTITY, UOM, DATE_TIME_OF_ENTRY,
  MOVEMENT_TYPE, STORAGE_ID, SOURCE_ST, USER
- MOVEMENT_TYPE 261 = pour (component issue); 262 = pour reversal
- MOVEMENT_TYPE 101 = goods receipt (production output); 102 = reversal
- Filter UOM to exclude meaningless units: `UOM NOT IN ('EA', 'G')` for volume analysis
- DATE_TIME_OF_ENTRY is a TIMESTAMP column (UTC) — use for time-based aggregation
- Always exclude reversal movement types (102, 262) unless specifically asked about reversals

## vw_gold_material

- Grain: one row per (MATERIAL_ID, LANGUAGE_ID)
- **Always filter LANGUAGE_ID = 'E'** for English descriptions — omitting this duplicates rows
- Key columns: MATERIAL_ID, MATERIAL_NAME, LANGUAGE_ID, MATERIAL_CATEGORY
- MATERIAL_ID is an 18-char string with leading zeros — never cast to integer
- Some materials have no English description — use COALESCE(MATERIAL_NAME, MATERIAL_ID)

## metric_schedule_adherence

- Grain: one row per completed process order (CONFIRMED or CLOSED only)
- **In-progress and released orders are not in this view**
- Key columns: ORDER_ID, MATERIAL_ID, PLANT_ID, PRODUCTION_LINE, ACTUAL_END_DATE,
  PLANNED_QTY, CONFIRMED_QTY, IS_ON_TIME, IS_IN_FULL, IS_OTIF, DELAY_DAYS, QTY_VARIANCE_PCT
- IS_ON_TIME: TRUE if ACTUAL_END_DATE <= PLANNED_END_DATE
- IS_IN_FULL: TRUE if CONFIRMED_QTY >= 0.95 × PLANNED_QTY (5% tolerance)
- IS_OTIF: TRUE if both IS_ON_TIME and IS_IN_FULL are TRUE
- DELAY_DAYS: positive = late, negative = early
- Aggregate adherence rate as `SUM(CASE WHEN IS_ON_TIME THEN 1 ELSE 0 END) / COUNT(*)`
  NOT as AVG(IS_ON_TIME) — the denominator must be total completed orders
- Always filter to a date range using ACTUAL_END_DATE

## metric_oee_daily

- Grain: one row per (PLANT_ID, PRODUCTION_LINE, PRODUCTION_DATE)
- Key columns: PLANT_ID, PRODUCTION_LINE, PRODUCTION_DATE, OEE_PCT, AVAILABILITY_PCT,
  PERFORMANCE_PCT, QUALITY_PCT, SCHEDULED_MINUTES, DOWNTIME_MINUTES,
  TOTAL_UNITS_PRODUCED, GOOD_UNITS_PRODUCED
- All percentage columns are 0–100, not 0–1
- Exclude days with zero SCHEDULED_MINUTES (no production planned): `WHERE SCHEDULED_MINUTES > 0`
- Weighted average OEE across lines: `SUM(OEE_PCT * SCHEDULED_MINUTES) / SUM(SCHEDULED_MINUTES)`
- Never plain-average OEE_PCT across lines — use the weighted formula above
- OEE above 85% is world-class for food manufacturing

## vw_gold_instrument

- Grain: one row per instrument/equipment item
- Key columns: INSTRUMENT_ID, EQUIPMENT_SUB_TYPE, NAME, SAP_RESOURCE, PLANT_ID
- **EQUIPMENT_TYPE is NOT a column in this view** — it exists in the bronze source but has
  not been promoted to gold. Group by EQUIPMENT_SUB_TYPE instead.
- EQUIPMENT_SUB_TYPE to type mapping (use CASE statement in queries):
  - 'Fixed', 'Mobile', 'Mobile-FixBin', 'ZIBC' → Vessel
  - 'Connected Scale', 'Manual Scale' → Scale
  - 'Bucket', 'Buckets', 'CCP Screen', 'Other', 'Pump' → Auxiliary Equipment
  - NULL or anything else → Uncategorised

## vw_gold_equipment_history

- Grain: one row per state-change event (INSTRUMENT_ID, CHANGE_AT)
- Key columns: INSTRUMENT_ID, STATUS_FROM, STATUS_TO, CHANGE_AT, PROCESS_ORDER_ID,
  MATERIAL_ID, PLANT_ID
- CHANGE_AT is a TIMESTAMP column (UTC epoch)
- STATUS_TO classification (heuristic keyword matching):
  - Contains 'AVAILABLE', 'CLEAN', 'IDLE' → vessel is clean/available
  - Contains 'DIRTY', 'CLEANING', 'WASH' → vessel needs cleaning
  - Contains 'IN USE', 'RUNNING', 'PROCESSING' → vessel is in production
- Do not assume STATUS_TO is an enum — it is a free-text field

## vw_gold_confirmation

- Contains production confirmations linked to process orders
- Join to vw_gold_process_order on PROCESS_ORDER_ID for order context
