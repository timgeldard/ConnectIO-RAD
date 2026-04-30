# Process Order History KPI Reference

This document describes the KPIs and derived metrics used by the Process Order History app. It is based on the current backend DALs and frontend page calculations.

## General Conventions

- Databricks SQL numeric values are coerced to Python or TypeScript numbers before display.
- Date-range analytics use the browser IANA timezone sent by the frontend where the backend supports timezone bucketing.
- If an analytics date range is omitted, most analytics endpoints fall back to a rolling 24-hour window for raw rows; OEE and adherence range queries fall back to the last 7 days.
- Movement quantities exclude `EA`. Quantities in `G` are converted to kilograms by dividing by `1000`; other units are treated as already kilogram-equivalent unless noted.
- Goods movement reversals are subtracted:
  - `262` subtracts from `261` goods issues.
  - `102` subtracts from `101` goods receipts.
- Plant filters are applied server-side where supported by the endpoint.

## Order List KPIs

Source files:
- `frontend/src/pages/OrderList.tsx`
- `backend/dal/orders_dal.py`
- `frontend/src/api/orders.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Active process orders | Count | Number of filtered orders where UI status is `running` | `vw_gold_process_order` status mapped through `ORDER_STATUS_EXPR` | Respects frontend search, status, product/category, line, and date filters. |
| Orders last 30 days | Count | Number of loaded orders with `start >= now - 30 days` | `vw_gold_confirmation.MIN(START_TIMESTAMP)` | Uses the full fetched order list, not only the currently filtered table. |
| Average yield | Percent | Average of non-null `yieldPct` values in the filtered order list | Frontend `Order.yieldPct` | The current API mapper sets `yieldPct` to `null`, so this card usually renders blank until list-level yield is wired in. |
| On hold | Count | Number of filtered orders where UI status is `onhold` | `vw_gold_process_order.STATUS` mapped through `ORDER_STATUS_EXPR` | Respects frontend filters. |
| POs started today | Count | Number of filtered orders whose `start` timestamp falls on the user's current local date | `vw_gold_confirmation.MIN(START_TIMESTAMP)` | Local browser date comparison. |
| POs completed today | Count | Number of filtered completed orders whose `end` timestamp falls on the user's current local date | `vw_gold_confirmation.MAX(END_TIMESTAMP)` and mapped status | Requires UI status `completed`. |
| Pours today | Count | Number of pour events returned for today's date | `/api/pours/analytics`, movement types `261` and `262` | Counts event rows for today; reversals are still rows in the event list, while trend counts net reversals. |

## Order Detail KPIs And Summary Metrics

Source files:
- `frontend/src/pages/OrderDetail.tsx`
- `backend/dal/order_detail_dal.py`
- `frontend/src/api/orders.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Quantity issued | kg | Net `261 - 262` movement quantity after unit normalization | `vw_gold_adp_movement` | Returns blank when the net issued quantity is `<= 0`. |
| Quantity received | kg | Net `101 - 102` movement quantity after unit normalization | `vw_gold_adp_movement` | Returns blank when the net received quantity is `<= 0`. |
| Detail yield | Percent | `qty_received_kg / qty_issued_kg * 100` | Derived from movement summary | Only shown when both issued and received quantities are present. The UI treats `>= 95%` as green. |
| Setup time | HH:MM:SS | Sum of `SET_UP_DURATION_S` across all phases | `vw_gold_confirmation` grouped by phase | Derived in `time_summary.setup_s`. |
| Machine time | HH:MM:SS | Sum of `MACHINE_DURATION_S` across all phases | `vw_gold_confirmation` grouped by phase | Derived in `time_summary.mach_s`. |
| Cleaning time | HH:MM:SS | Sum of `CLEANING_DURATION_S` across all phases | `vw_gold_confirmation` grouped by phase | Derived in `time_summary.clean_s`. |
| Material component quantity | kg or source UOM | Net `261 - 262` quantity per component material | `vw_gold_adp_movement` | `EA` is excluded, `G` is normalized to `KG`, fully reversed components are omitted. |
| Downtime count | Count | Number of downtime/issue rows for the order | `vw_gold_downtime_and_issues` | Shown in the downtime card header. |
| Downtime duration | Minutes | `sum(duration_s) / 60` | `vw_gold_downtime_and_issues.DURATION` | Order-detail side-card summary. |
| Inspection result count | Count | Number of inspection characteristic result rows | `vw_gold_inspection_result` | Used in section anchor and inspection view. |
| Inspection accepted/rejected judgement | A/R | `INSPECTION_RESULT_VALUATION LIKE 'A%'` means accepted; all other values mean rejected | `vw_gold_inspection_result` | Null/non-`A%` valuations are treated as rejected. |
| Usage decision quality score | Score | `QUALITY_SCORE` from usage decision | `vw_gold_inspection_usage_decision` | Displayed in the usage decision panel when a lot decision exists. |

## Planning Board KPIs

Source files:
- `frontend/src/pages/PlanningBoard.tsx`
- `backend/dal/planning_dal.py`
- `frontend/src/api/planning.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Lines running | `runningCount / totalLines` | `runningCount = count(block.kind == "running")`; `totalLines = distinct lineId count` | Scheduled blocks from `silver_process_order` joined to gold process orders | Cancelled blocks are excluded. |
| Today's quantity | Tonnes | `sum(block.qty for blocks starting today) / 1000` | Planning blocks | Current backend sets block `qty` to `0`, so this remains `0.0t` until planned quantity is promoted into the schedule query. |
| Orders today | Count | Count of blocks with `today_start <= block.start < today_end` | Planning blocks | Displayed as subtext under today's quantity. |
| Utilization | Percent | Currently hardcoded to `0` | Placeholder | Requires a capacity master or schedule adherence metric view. |
| On time | Percent | Currently hardcoded to `0` | Placeholder | Requires a schedule adherence source for closed orders. |
| At risk | Count | Currently hardcoded to `0` | Placeholder | Intended for schedule-risk logic. |
| Shortages | Count | Currently hardcoded to `0` | Placeholder | Intended for material availability or WM shortage logic. |
| WM in transit | Count | Currently hardcoded to `0` | Placeholder | Displayed as shortage card subtext. |
| Downtime 24h | Hours/minutes | Currently hardcoded to `0` | Placeholder | Planning board has UI affordance for downtime but the current backend does not populate it. |
| Active downtime count | Count | Currently hardcoded to `0` | Placeholder | Displayed as downtime card subtext. |
| Backlog | Count | `len(backlog)` | Released/unstarted orders from `vw_gold_process_order` | Backlog query is capped at 30 rows. |
| Urgent backlog | Count | Currently hardcoded to `0` | Placeholder | Backlog priority is currently `normal`. |

## Day View KPIs

Source files:
- `frontend/src/pages/DayView.tsx`
- `backend/dal/day_view_dal.py`
- `frontend/src/api/day_view.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Orders | Count | `len(blocks)` | Orders with confirmation activity on the selected day | Planned or zero-activity orders are excluded by the confirmation join. |
| Completed | Count | Count of blocks where `kind == "completed"` | Process order status mapped from gold status | `COMPLETED` and `CLOSED` map to completed. |
| Quantity confirmed | KG | Sum of `confirmedQty` across day blocks | Net `101 - 102` movements on selected day | Rounded to 3 decimals in backend, displayed with no decimals. |
| Downtime events | Count | `len(downtime)` | `vw_gold_downtime_and_issues` rows starting on selected day | Joined to process orders for line attribution. |
| Downtime | Minutes | `sum((downtime.end - downtime.start) / 60000)` | Coerced downtime overlays | Durations are clamped to selected-day boundaries and rounded to 1 decimal in backend. |

## Pour Analytics KPIs

Source files:
- `frontend/src/pages/PourAnalytics.tsx`
- `backend/dal/pours_analytics_dal.py`
- `frontend/src/api/pours.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Pour target | Count | `350 * days_in_selected_range` | Frontend constant `DAILY_TARGET = 350` | A planning target, not read from Databricks. |
| Planned pours | Count | `planned_24h` from backend | Backend currently returns `None` | Planned pour count is disabled pending universal silver schedule access. |
| Actual pours | Count | Number of filtered event rows | `vw_gold_adp_movement` movement types `261` and `262` | Source type filter affects this count. |
| Percent of plan | Percent | `actual / planned * 100`, rounded | Actual event count and `planned_24h` | Hidden when planned is null or zero. |
| Prior 7-day pour delta | Percent | `(current actual - prior actual) / prior actual * 100` | Current events and prior-7-day events | Only shown when comparison mode is `prior7d` and prior count is non-zero. |
| Daily pour count | Count | Net `sum(261 as +1, 262 as -1)` per local day | `vw_gold_adp_movement` | Zero-padded over the last 30 days. |
| Hourly pour count | Count | Net `sum(261 as +1, 262 as -1)` per local hour | `vw_gold_adp_movement` | Zero-padded over the last 24 hours. |
| Breakdown pour count | Count | Count of event rows per selected group | Current events | Grouping options: operator, shift, source type, source area, process order. |
| Breakdown volume | Tonnes | `sum(quantity_kg) / 1000` per selected group | Current events | `G` quantities are normalized to kg in SQL. |
| Breakdown vs average | Percent | `(group_count - average_group_count) / average_group_count * 100` | Current grouped event counts | Used in the breakdown table. |
| Prior 7-day daily average | Count/day | For each group: prior-7-day count divided by active days with data | Prior-7-day events | Not calculated for process-order grouping. |

## Yield Analytics KPIs

Source files:
- `frontend/src/pages/YieldAnalytics.tsx`
- `backend/dal/yield_analytics_dal.py`
- `frontend/src/api/yield.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Target yield | Percent | Constant `95.0` | Backend `TARGET_YIELD_PCT` | Used as the visual quality threshold. |
| Average yield | Percent | Average of non-null order `yield_pct` values in the selected period/material filter | Per-order yield rows | Frontend averages order percentages equally. |
| Average yield prior delta | Percent | `(current_avg_yield - prior_avg_yield) / prior_avg_yield * 100` | Current and prior-7-day order yield rows | Displayed by `DeltaPill` when comparison is enabled. |
| Total loss | kg | `sum(loss_kg)` over selected orders | Per-order yield rows | Lower is better; comparison pill uses inverted tone. |
| Total loss prior delta | Percent | `(current_loss - prior_loss) / prior_loss * 100` | Current and prior-7-day order yield rows | Lower is treated as favorable. |
| Per-order yield | Percent | `qty_received_kg / qty_issued_kg * 100` when issued quantity is positive | Net `101 - 102` receipts and net `261 - 262` issues | Orders must have at least one `101` receipt in range to appear. |
| Per-order loss | kg | `qty_issued_kg - qty_received_kg` when issued quantity is positive | Same as per-order yield | Rounded in SQL to 3 decimals. |
| Daily average yield trend | Percent | `sum(received_kg) / sum(issued_kg) * 100` per local day | `vw_gold_adp_movement` | Zero-padded over the last 30 days; null for no data. |
| Hourly average yield trend | Percent | `sum(received_kg) / sum(issued_kg) * 100` per local hour | `vw_gold_adp_movement` | Zero-padded over the last 24 hours; null for no data. |
| Breakdown yield | Percent | Per group: `sum(qty_received_kg) / sum(qty_issued_kg) * 100` | Current selected yield orders | Grouping options: material, process order. |
| Breakdown loss | kg | Per group: `sum(qty_issued_kg) - sum(qty_received_kg)` | Current selected yield orders | Groups with no issued quantity have null yield/loss. |
| Breakdown order count | Count | Number of orders in each group | Current selected yield orders | Process-order grouping is capped to 50 rows in the UI. |
| Prior 7-day group average yield | Percent | Per group: `sum(received_kg) / sum(issued_kg) * 100` over prior-7-day rows | Prior-7-day yield rows | Only calculated for material grouping. |

## Quality Analytics KPIs

Source files:
- `frontend/src/pages/QualityAnalytics.tsx`
- `backend/dal/quality_analytics_dal.py`
- `frontend/src/api/quality.ts`

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Accepted results | Count | Count of selected rows where `judgement == "A"` | `vw_gold_inspection_result` joined through usage decision | `INSPECTION_RESULT_VALUATION LIKE 'A%'` means accepted. |
| Right first time | Percent | `accepted / (accepted + rejected) * 100` | Selected inspection result rows | Null when there are no selected inspection rows. |
| RFT prior delta | Percent | `(current_rft - prior_rft) / prior_rft * 100` | Current rows and prior-7-day rows | Displayed when comparison is enabled and prior data exists. |
| Rejected results | Count | Count of selected rows where `judgement == "R"` | `vw_gold_inspection_result` | Any non-`A%` valuation, including null, is rejected. |
| Reject rate | Percent | `rejected / (accepted + rejected) * 100` | Selected inspection result rows | Tone is favorable at `<= 2%`, neutral at `<= 5%`, unfavorable above `5%`. |
| Daily accepted count | Count | Accepted inspection result count per local day | Usage decision timestamp | Zero-padded over the last 30 days. |
| Daily rejected count | Count | Rejected inspection result count per local day | Usage decision timestamp | Zero-padded over the last 30 days. |
| Daily RFT trend | Percent | `accepted / (accepted + rejected) * 100` per local day | Daily accepted/rejected counts | Null for zero-result days. |
| Hourly accepted count | Count | Accepted inspection result count per local hour | Usage decision timestamp | Zero-padded over the last 24 hours. |
| Hourly rejected count | Count | Rejected inspection result count per local hour | Usage decision timestamp | Zero-padded over the last 24 hours. |
| Hourly RFT trend | Percent | `accepted / (accepted + rejected) * 100` per local hour | Hourly accepted/rejected counts | Null for zero-result hours. |
| Breakdown accepted | Count | Accepted count per selected group | Current selected rows | Grouping options: characteristic, material, process order, judgement. |
| Breakdown rejected | Count | Rejected count per selected group | Current selected rows | Default sort is rejected count descending. |
| Breakdown reject percent | Percent | `rejected / (accepted + rejected) * 100` per group | Current selected rows | Process-order grouping is capped to 30 rows in the UI. |
| Breakdown order count | Count | Distinct process order count per group | Current selected rows | Uses a set of `process_order` values. |
| Prior 7-day rejected daily average | Count/day | For each group: prior rejected count divided by active days with data | Prior-7-day rows | Not calculated for process-order grouping. |
| Quality score | Score | `QUALITY_SCORE` from usage decision | `vw_gold_inspection_usage_decision` | Exposed in the raw rows/download and order detail usage decision. |

## Cross-Metric Correlation KPIs

Source file:
- `frontend/src/pages/analyticsShared.tsx`

These cards are computed in the browser by fetching pour, yield, and quality analytics for the same plant/date filters.

| KPI | Display | Calculation | Notes |
| --- | --- | --- | --- |
| Yield and quality overlap | Count | Number of low-yield orders whose process order ID also appears in rejected inspection rows | Low yield means `yield_pct < target_yield_pct`. |
| Material hotspot | Material name | Highest material score from yield loss, quality rejects, and pour activity | Score adds yield loss kg, `10` points per reject, and pour quantity divided by `100`. It is a heuristic ranking, not a governed plant metric. |
| Yield movement | Percent | Average current yield, with point difference from prior-7-day average | Uses equal-weighted order yield percentages. |
| Quality drag | Percent | Current reject rate with prior reject-rate context | Reject rate is `rejected / total inspection rows * 100`. |
| Pour volume pressure | Count | Current pour event count, with percent change versus prior 7 days | Tone becomes unfavorable when pour count is up more than 20% while yield is down versus prior. |


## Equipment Insights KPIs

Source files:
- `frontend/src/pages/EquipmentInsights.tsx`
- `backend/dal/equipment_insights_dal.py`
- `frontend/src/api/equipment_insights.ts`

### Estate

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Total instruments | Count | `COUNT(*)` from vw_gold_instrument | `vw_gold_instrument` | Excludes Single-Use Vessel rows. |
| Equipment types | Count | Distinct EQUIPMENT_TYPE values excluding Uncategorised | Derived via `_aggregate_by_type` | Requires subtype-to-type mapping until EQUIPMENT_TYPE is promoted from bronze. |
| Uncategorised instruments | Count | Instruments whose EQUIPMENT_SUB_TYPE maps to no known type | `_SUBTYPE_TO_TYPE` mapping | Shown only when count > 0. Includes NULL EQUIPMENT_SUB_TYPE rows. |

### State / Readiness

State is classified from the most recent `STATUS_TO` per instrument in `vw_gold_equipment_history` (last 90 days).  
Classification uses substring keyword matching against three frozensets (IN_USE_KEYWORDS, DIRTY_KEYWORDS, AVAILABLE_KEYWORDS).

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| In use | Count / % | Instruments whose latest STATUS_TO matches in-use keywords | `vw_gold_equipment_history` latest-event CTE | Keywords: IN USE, RUNNING, OCCUPIED, ACTIVE, PRODUCTION, PROCESS, etc. |
| Dirty / needs clean | Count / % | Instruments whose latest STATUS_TO matches dirty keywords | `vw_gold_equipment_history` | Keywords: DIRTY, CIP REQUIRED, SOAKING, AWAITING CLEAN, etc. |
| Available / clean | Count / % | Instruments whose latest STATUS_TO matches available keywords | `vw_gold_equipment_history` | Keywords: AVAILABLE, CLEAN, READY, IDLE, SANITISED, etc. |
| Unknown | Count / % | Instruments with no keyword match or no history in the last 90 days | `vw_gold_equipment_history` | NULL STATUS_TO also maps to unknown. |

### Activity

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Peak active instruments / day | Count | Max of the 30-day daily series | `vw_gold_equipment_history` | Shown as chart meta-label. |
| Peak active instruments / hour | Count | Max of the 24-hour hourly series | `vw_gold_equipment_history` | Shown as chart meta-label. |
| Daily active instruments trend | Count per day | `COUNT(DISTINCT INSTRUMENT_ID)` per local calendar day, last 30 days | `vw_gold_equipment_history` | Zero-padded; day boundaries align to browser timezone. |
| Hourly active instruments trend | Count per hour | `COUNT(DISTINCT INSTRUMENT_ID)` per local hour, last 24 hours | `vw_gold_equipment_history` | Zero-padded; hour boundaries align to browser timezone. |

### Verification / Compliance

| KPI | Display | Calculation | Source data | Notes |
| --- | --- | --- | --- | --- |
| Scale verification | Placeholder | Not implemented | `scale_verification_results` (RESTRICTED) | Blocked pending a Unity Catalogue consumption view for `connected_plant_prod.tulip.scale_verification_results`. Frontend shows an amber badge with a TODO note. |

## Backend Analytics Metrics Not Currently Exposed As A Primary Page

The backend also contains OEE, schedule adherence, and downtime analytics DALs and routers. These metrics are part of the processorderhistory API surface even though they do not currently have a dedicated frontend page in this app shell.

### OEE Analytics

Source: `backend/dal/oee_analytics_dal.py`

| Metric | Calculation | Source data | Notes |
| --- | --- | --- | --- |
| Average OEE | `sum(OEE_PCT * SCHEDULED_MINUTES) / sum(SCHEDULED_MINUTES)` | `metric_oee_daily` | Weighted by scheduled minutes. |
| Average availability | `sum(AVAILABILITY_PCT * SCHEDULED_MINUTES) / sum(SCHEDULED_MINUTES)` | `metric_oee_daily` | Weighted by scheduled minutes. |
| Average performance | `sum(PERFORMANCE_PCT * SCHEDULED_MINUTES) / sum(SCHEDULED_MINUTES)` | `metric_oee_daily` | Weighted by scheduled minutes. |
| Average quality | `sum(QUALITY_PCT * SCHEDULED_MINUTES) / sum(SCHEDULED_MINUTES)` | `metric_oee_daily` | Weighted by scheduled minutes. |
| Total scheduled minutes | `sum(SCHEDULED_MINUTES)` | `metric_oee_daily` | Rows with `SCHEDULED_MINUTES <= 0` are excluded. |
| Total downtime minutes | `sum(DOWNTIME_MINUTES)` | `metric_oee_daily` | Range metric grouped by production line. |
| Total units | `sum(TOTAL_UNITS_PRODUCED)` | `metric_oee_daily` | Range metric grouped by production line. |
| Good units | `sum(GOOD_UNITS_PRODUCED)` | `metric_oee_daily` | Range metric grouped by production line. |
| Daily OEE trend | Same weighted OEE formula per production date | `metric_oee_daily` | Zero-padded over the last 30 days. |

### Schedule Adherence Analytics

Source: `backend/dal/adherence_analytics_dal.py`

| Metric | Calculation | Source data | Notes |
| --- | --- | --- | --- |
| On-time flag | `IS_ON_TIME` | `metric_schedule_adherence` | Order-level boolean coerced to a frontend boolean. |
| In-full flag | `IS_IN_FULL` | `metric_schedule_adherence` | Order-level boolean coerced to a frontend boolean. |
| OTIF flag | `IS_OTIF` | `metric_schedule_adherence` | Order-level boolean coerced to a frontend boolean. |
| Delay days | `DELAY_DAYS` | `metric_schedule_adherence` | Order-level integer. |
| Quantity variance | `QTY_VARIANCE_PCT` | `metric_schedule_adherence` | Order-level percentage. |
| Daily on-time rate | `sum(IS_ON_TIME) / count(*) * 100` | `metric_schedule_adherence` | Last 30 days. |
| Daily in-full rate | `sum(IS_IN_FULL) / count(*) * 100` | `metric_schedule_adherence` | Last 30 days. |
| Daily OTIF rate | `sum(IS_OTIF) / count(*) * 100` | `metric_schedule_adherence` | Last 30 days. |
| Daily order count | `count(*)` | `metric_schedule_adherence` | Last 30 days. |

### Downtime Analytics

Source: `backend/dal/downtime_analytics_dal.py`

| Metric | Calculation | Source data | Notes |
| --- | --- | --- | --- |
| Downtime duration by reason | `sum(DURATION)` grouped by `REASON_CODE` and `ISSUE_TITLE` | `vw_gold_downtime_and_issues` | Returned in seconds and sorted descending. |
| Downtime event count by reason | `count(*)` grouped by `REASON_CODE` and `ISSUE_TITLE` | `vw_gold_downtime_and_issues` | Same date range as duration by reason. |
| Daily downtime duration | `sum(DURATION)` per local day | `vw_gold_downtime_and_issues` | Zero-padded over the last 30 days. |
| Daily downtime event count | `count(*)` per local day | `vw_gold_downtime_and_issues` | Zero-padded over the last 30 days. |
