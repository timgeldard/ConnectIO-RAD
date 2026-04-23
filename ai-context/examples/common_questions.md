# Common Business Questions → Query Mapping

> Maps natural-language questions to the correct query pattern.
> Agents should match user intent to these patterns before writing SQL.

## Traceability Questions

| Question | Pattern | Key Tables | Notes |
|---|---|---|---|
| "Where did batch X end up?" | Forward trace (Pattern 1) | gold_batch_lineage | Use RECURSIVE CTE, depth limit, cycle detection |
| "What went into batch X?" | Reverse trace (Pattern 1 reversed) | gold_batch_lineage | Swap PARENT/CHILD in anchor |
| "Which customers got batch X?" | Customer impact (Pattern 4) | gold_batch_delivery_v | Deduplicate deliveries first |
| "How many countries?" | Customer impact (Pattern 4) | gold_batch_delivery_v | COUNT(DISTINCT COUNTRY_ID) |
| "Show the blast radius for a recall" | Exposure query | gold_batch_lineage + stock + delivery | Combine forward trace with stock/delivery joins |

## Stock & Inventory Questions

| Question | Pattern | Key Tables | Notes |
|---|---|---|---|
| "What's the current stock?" | Direct query | gold_batch_stock_v | SUM and GROUP BY MATERIAL_ID, BATCH_ID |
| "Is batch X blocked?" | Batch status (Pattern 2) | gold_batch_stock_v + quality_summary | Check BLOCKED > 0 or rejected_result_count > 0 |
| "Show inventory over time" | Running balance (Pattern 6) | gold_batch_mass_balance_v | Use window function with signed BALANCE_QTY |
| "Mass balance for batch X" | Mass balance (Pattern 3) | gold_batch_mass_balance_v + stock | Exclude STO movements |

## Quality Questions

| Question | Pattern | Key Tables | Notes |
|---|---|---|---|
| "Show the CoA for batch X" | CoA query (Pattern 7) | gold_batch_quality_result_v | All MIC results for one batch |
| "Did batch X pass quality?" | Batch status (Pattern 2) | gold_batch_quality_summary_v | rejected_result_count = 0 means pass |
| "What's the first pass yield?" | FPY query (Pattern 8) | gold_batch_quality_summary_v | Across a date range or plant |
| "Which MICs failed?" | Filtered CoA | gold_batch_quality_result_v | WHERE INSPECTION_RESULT_VALUATION = 'R' |

## Questions That Require Clarification

| Question | Why | What to ask |
|---|---|---|
| "Show me the data" | Too vague | "Which batch, material, or plant are you interested in?" |
| "What's the yield?" | Multiple definitions | "Do you mean first pass yield (quality) or production yield (mass balance)?" |
| "Show all movements" | Potentially huge result | "For which batch and date range?" |
| "Is this batch safe?" | Subjective | "Do you want the quality inspection results, stock status, or both?" |

## Questions That Should NOT Be Answered From This Data

| Question | Reason |
|---|---|
| "What's the cost of batch X?" | Cost data is not in the gold layer — lives in finance tables |
| "Who approved the batch?" | User/approver data not exposed in these views |
| "What's the shelf life?" | Expiry dates not modelled in current gold views — assumed 24 months |
| "Show me the production plan" | Planning data (MRP) not in scope — only actuals |
