# Behavioral Rules

## Always Do

- **Filter LANGUAGE_ID = 'E'** whenever joining vw_gold_material. Omitting this produces
  one duplicate row per language code per material.

- **Exclude CANCELLED orders** from all KPI calculations:
  `WHERE STATUS != 'CANCELLED'` on vw_gold_process_order.

- **Exclude reversal movements** (102, 262) from quantity totals unless the user
  explicitly asks about reversals.

- **Filter SCHEDULED_MINUTES > 0** when querying metric_oee_daily to exclude
  days with no planned production.

- **Use weighted average for OEE**: `SUM(OEE_PCT * SCHEDULED_MINUTES) / SUM(SCHEDULED_MINUTES)`
  — never plain AVG(OEE_PCT) across lines or time periods.

- **Prefer page context** when provided in the application context block. If
  selected_process_order, selected_plant, or active_date_range are set, use them
  to scope the query unless the user explicitly overrides them.

- **Use COALESCE for MATERIAL_NAME**: `COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)`
  to handle materials with no English description.

- **Exclude EA and G from UOM** when analysing pour quantities (EA = each, G = grams
  — these are not production volume units): `WHERE UOM NOT IN ('EA', 'G')`.

## Never Do

- **Never query scale_verification_results** — it lives in connected_plant_prod.tulip
  and requires a Unity Catalogue view that does not yet exist. Attempting to query it
  directly will fail with a permissions error.

- **Never cast MATERIAL_ID or PROCESS_ORDER_ID to integer** — both are SAP strings
  with significant leading zeros.

- **Never compute EQUIPMENT_TYPE from vw_gold_instrument** as a column lookup —
  it does not exist in that view. Use the EQUIPMENT_SUB_TYPE CASE statement defined
  in the table rules instead.

- **Never average OEE_PCT directly** across lines or time periods without weighting
  by SCHEDULED_MINUTES.

- **Never include in-progress orders in schedule adherence calculations** —
  metric_schedule_adherence contains completed orders only. Check vw_gold_process_order
  for in-progress status.

- **Never re-derive IS_ON_TIME, IS_IN_FULL, or IS_OTIF** — use the pre-calculated
  columns in metric_schedule_adherence.

## Formatting Guidance

- Express OEE, yield, and schedule adherence as percentages rounded to one decimal place.
- Express quantities with the UOM suffix (e.g. "1,245 KG").
- When a question is about "this week" or "this month" and no date range is in context,
  ask the user to confirm the date range rather than assuming.
- When the data cannot answer a question (e.g. vessel planning requires context about
  planned orders not yet confirmed), state the limitation clearly rather than guessing.
- Return plant codes (LND1, RCN1) as-is — there is no plant name lookup in this space.
