# Process Order History Genie Space

## Space

**Title:** Process Order History Analysis

**Audience:** planners, manufacturing operations, quality, and supply chain analysts.

The Genie Space is the durable semantic layer for this app. Keep business definitions, table curation, example questions, and trusted SQL in the Space. The app should only send ephemeral UI context, such as the selected process order, active filters, and date range.

## Recommended Source Model

- `curated.fact_process_order_history`
- `curated.dim_material`
- `curated.dim_plant`
- `curated.dim_work_center`
- `curated.fact_goods_movement`
- `curated.fact_confirmations`
- Optional: curated batch genealogy view

Map these to the deployed environment's Unity Catalog objects. For the current app schema, candidate source views live under `${POH_CATALOG}.${POH_SCHEMA}` and should be promoted into curated Genie-friendly facts/dimensions before production use.

## Instruction Set

- Treat the curated process order history fact as the primary source.
- Explain SAP abbreviations in plain language.
- When asked "why is this late," compare planned vs actual milestone timestamps and identify the largest delay segment.
- Prefer current page context when provided by the app.
- Return timestamps in the plant local timezone if available.
- Be explicit when a metric is unavailable from the curated model.
- Do not infer batch genealogy unless the batch genealogy view is part of the Space.

## Example Questions

- What happened to process order 123456 and when?
- Why is this order late?
- Which orders had goods receipt more than 24 hours after final confirmation?
- Show long gaps between release and first confirmation by plant.
- Which materials have the longest completion times this month?
- For the current filtered orders, which process order has the largest delay between final confirmation and goods receipt?

## Suggested Measures And Snippets

- `release_to_first_confirmation_hours`
- `final_confirmation_to_gr_hours`
- `total_order_cycle_hours`
- `status_dwell_time_hours`
- `late_order_flag`

## Benchmark And Curation Notes

- Build a benchmark set from known late orders, completed on-time orders, orders with reversed movements, and orders with missing confirmations.
- Validate that Genie distinguishes planned timestamps, confirmation timestamps, and goods movement timestamps.
- Include examples that use the app's context block, especially selected process order and active date range.
- Keep serialized Genie Space payloads under source control when exported through the Genie Space management APIs.
- Promote spaces across environments by applying serialized Space payloads through Databricks Genie Space APIs, then linking the environment-specific Space ID to the Databricks App resource.
