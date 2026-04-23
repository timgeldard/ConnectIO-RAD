-- =============================================================================
-- CANONICAL SQL PATTERNS — Approved Query Templates
-- =============================================================================
--
-- PURPOSE:  These are the APPROVED query patterns for common operations.
--           Agents MUST use these patterns rather than inventing their own.
--           All queries use {{CATALOG}}.gold.table_name format.
--
-- PARAMETERIZATION:
--   - Use :param_name for named parameters (Databricks SQL Statement API)
--   - Use {{CATALOG}} for catalog name (resolved at runtime)
--
-- =============================================================================


-- ---------------------------------------------------------------------------
-- PATTERN 1: Forward trace (downstream) with cycle detection
-- ---------------------------------------------------------------------------
-- Use: Find all batches produced FROM a given input batch
-- Required: WITH RECURSIVE keyword
-- Trap: Always include cycle detection via path tracking

WITH RECURSIVE unique_edges AS (
  SELECT DISTINCT
    PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
    CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID, LINK_TYPE
  FROM {{CATALOG}}.gold.gold_batch_lineage
  WHERE CHILD_BATCH_ID IS NOT NULL
    AND LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER', 'STO_TRANSFER')
),
trace AS (
  -- Anchor: direct children of the target batch
  SELECT
    1 AS trace_level,
    CHILD_MATERIAL_ID AS material_id,
    CHILD_BATCH_ID AS batch_id,
    CHILD_PLANT_ID AS plant_id,
    CONCAT(',', CHILD_MATERIAL_ID, '|', CHILD_BATCH_ID, ',') AS path
  FROM unique_edges
  WHERE PARENT_MATERIAL_ID = :material_id AND PARENT_BATCH_ID = :batch_id
  UNION ALL
  -- Recurse: children of children
  SELECT
    t.trace_level + 1,
    e.CHILD_MATERIAL_ID,
    e.CHILD_BATCH_ID,
    e.CHILD_PLANT_ID,
    CONCAT(t.path, e.CHILD_MATERIAL_ID, '|', e.CHILD_BATCH_ID, ',')
  FROM unique_edges e
  JOIN trace t
    ON e.PARENT_MATERIAL_ID = t.material_id
    AND e.PARENT_BATCH_ID = t.batch_id
  WHERE t.trace_level < :max_depth                                        -- depth guard
    AND INSTR(t.path,
        CONCAT(',', e.CHILD_MATERIAL_ID, '|', e.CHILD_BATCH_ID, ',')
    ) = 0                                                                  -- cycle detection
)
SELECT DISTINCT material_id, batch_id, plant_id, trace_level
FROM trace
ORDER BY trace_level, material_id;


-- ---------------------------------------------------------------------------
-- PATTERN 2: Batch status derivation
-- ---------------------------------------------------------------------------
-- Use: Determine if a batch is Released, Blocked, QI Hold, etc.
-- Sources: gold_batch_stock_v + gold_batch_quality_summary_v
-- Trap: Always pre-aggregate stock across plants

WITH stk AS (
  SELECT
    SUM(UNRESTRICTED) AS unrestricted,
    SUM(BLOCKED) AS blocked,
    SUM(QUALITY_INSPECTION) AS qi,
    SUM(RESTRICTED) AS restricted,
    SUM(TOTAL_STOCK) AS current_stock
  FROM {{CATALOG}}.gold.gold_batch_stock_v
  WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
),
qs AS (
  SELECT accepted_result_count, rejected_result_count, failed_mic_count
  FROM {{CATALOG}}.gold.gold_batch_quality_summary_v
  WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
)
SELECT
  CASE
    WHEN COALESCE(stk.blocked, 0) > 0
      OR COALESCE(qs.rejected_result_count, 0) > 0 THEN 'Blocked'
    WHEN COALESCE(stk.qi, 0) > 0
      OR COALESCE(qs.failed_mic_count, 0) > 0 THEN 'QI Hold'
    WHEN COALESCE(qs.accepted_result_count, 0) > 0 THEN 'Released'
    WHEN COALESCE(stk.unrestricted, 0) > 0 THEN 'Released'
    ELSE 'Unknown'
  END AS batch_status
FROM stk CROSS JOIN qs;


-- ---------------------------------------------------------------------------
-- PATTERN 3: Mass balance for a batch
-- ---------------------------------------------------------------------------
-- Use: Calculate produced vs shipped vs current stock variance
-- Trap: Exclude STO movements to avoid double-counting

WITH stk AS (
  SELECT
    SUM(UNRESTRICTED) AS unrestricted,
    SUM(BLOCKED + RESTRICTED) AS held,
    SUM(TOTAL_STOCK) AS actual_stock
  FROM {{CATALOG}}.gold.gold_batch_stock_v
  WHERE BATCH_ID = :batch_id
),
mb AS (
  SELECT
    COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Production' THEN ABS_QUANTITY ELSE 0 END), 0) AS total_produced,
    COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment'   THEN ABS_QUANTITY ELSE 0 END), 0) AS total_shipped
  FROM {{CATALOG}}.gold.gold_batch_mass_balance_v
  WHERE BATCH_ID = :batch_id
    AND MOVEMENT_CATEGORY NOT LIKE 'STO%'   -- exclude inter-plant transfers
)
SELECT
  mb.total_produced,
  mb.total_shipped,
  COALESCE(stk.actual_stock, 0) AS current_stock,
  COALESCE(stk.actual_stock, 0) - (mb.total_produced - mb.total_shipped) AS variance
FROM mb CROSS JOIN stk;


-- ---------------------------------------------------------------------------
-- PATTERN 4: Customer impact analysis
-- ---------------------------------------------------------------------------
-- Use: Find all customers and countries that received a batch
-- Trap: Deduplicate deliveries before aggregating

WITH per_delivery AS (
  SELECT DISTINCT
    DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, COUNTRY_NAME, ABS_QUANTITY
  FROM {{CATALOG}}.gold.gold_batch_delivery_v
  WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
    AND DELIVERY IS NOT NULL
)
SELECT
  CUSTOMER_ID AS id,
  MAX(CUSTOMER_NAME) AS name,
  MAX(COUNTRY_ID) AS country,
  COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
  COUNT(DISTINCT DELIVERY) AS deliveries
FROM per_delivery
GROUP BY CUSTOMER_ID
ORDER BY qty DESC;


-- ---------------------------------------------------------------------------
-- PATTERN 5: Material description lookup
-- ---------------------------------------------------------------------------
-- Use: Resolve human-readable name for a material
-- Trap: ALWAYS filter LANGUAGE_ID = 'E'

SELECT MATERIAL_ID, MATERIAL_NAME
FROM {{CATALOG}}.gold.gold_material
WHERE MATERIAL_ID = :material_id
  AND LANGUAGE_ID = 'E';


-- ---------------------------------------------------------------------------
-- PATTERN 6: Running inventory balance over time
-- ---------------------------------------------------------------------------
-- Use: Time-series of stock level for charts
-- Trap: Use BALANCE_QTY (signed) for running sum, exclude STO

WITH daily_balance AS (
  SELECT
    POSTING_DATE,
    SUM(BALANCE_QTY) AS daily_net
  FROM {{CATALOG}}.gold.gold_batch_mass_balance_v
  WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
    AND MOVEMENT_CATEGORY NOT LIKE 'STO%'
  GROUP BY POSTING_DATE
)
SELECT
  POSTING_DATE,
  SUM(daily_net) OVER (ORDER BY POSTING_DATE) AS inventory_level
FROM daily_balance
ORDER BY POSTING_DATE;


-- ---------------------------------------------------------------------------
-- PATTERN 7: Quality Certificate of Analysis (CoA)
-- ---------------------------------------------------------------------------
-- Use: List all MIC results for a batch in CoA format

SELECT
  r.MIC_ID AS mic_code,
  r.MIC_NAME AS mic_name,
  r.TARGET_VALUE AS target_value,
  r.TOLERANCE AS tolerance_range,
  r.QUANTITATIVE_RESULT AS actual_result,
  r.INSPECTION_RESULT_VALUATION AS result_status,
  CASE
    WHEN r.QUANTITATIVE_RESULT IS NOT NULL
      AND r.TARGET_VALUE IS NOT NULL
      AND TRY_CAST(r.TOLERANCE AS DOUBLE) IS NOT NULL
    THEN CASE
      WHEN ABS(r.QUANTITATIVE_RESULT - r.TARGET_VALUE)
           <= TRY_CAST(r.TOLERANCE AS DOUBLE)
      THEN 'Within spec' ELSE 'Out of spec'
    END
    WHEN r.INSPECTION_RESULT_VALUATION = 'A' THEN 'Within spec'
    WHEN r.INSPECTION_RESULT_VALUATION = 'R' THEN 'Out of spec'
    ELSE 'No result'
  END AS within_spec
FROM {{CATALOG}}.gold.gold_batch_quality_result_v r
WHERE r.MATERIAL_ID = :material_id AND r.BATCH_ID = :batch_id
ORDER BY r.INSPECTION_LOT_ID, r.OPERATION_ID, r.MIC_ID, r.SAMPLE_ID;


-- ---------------------------------------------------------------------------
-- PATTERN 8: First pass yield per plant
-- ---------------------------------------------------------------------------
-- Use: Calculate FPY over a date range

SELECT
  l.PLANT_ID,
  p.PLANT_NAME,
  COUNT(DISTINCT CASE WHEN qs.rejected_result_count = 0 THEN qs.BATCH_ID END) AS passed_batches,
  COUNT(DISTINCT qs.BATCH_ID) AS total_batches,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN qs.rejected_result_count = 0 THEN qs.BATCH_ID END)
    / NULLIF(COUNT(DISTINCT qs.BATCH_ID), 0),
    2
  ) AS fpy_pct
FROM {{CATALOG}}.gold.gold_batch_quality_summary_v qs
JOIN {{CATALOG}}.gold.gold_batch_quality_lot_v l
  ON l.INSPECTION_LOT_ID = qs.MATERIAL_ID  -- Note: join keys depend on your view
  AND l.BATCH_ID = qs.BATCH_ID
LEFT JOIN {{CATALOG}}.gold.gold_plant p ON p.PLANT_ID = l.PLANT_ID
WHERE l.LOT_CREATED_DATE BETWEEN :start_date AND :end_date
GROUP BY l.PLANT_ID, p.PLANT_NAME
ORDER BY fpy_pct;
