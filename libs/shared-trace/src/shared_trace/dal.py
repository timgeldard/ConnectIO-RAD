from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from shared_trace.tree import build_trace_tree

RunSqlAsync = Callable[[str, str, list[dict] | None], Awaitable[list[dict]]]
SqlParam = Callable[[str, Any], dict]
TableRef = Callable[[str], str]


@dataclass(frozen=True)
class TraceCoreDal:
    """
    Core Data Access Layer for material and batch traceability.
    
    Provides high-performance, asynchronous methods to traverse material lineage
    and aggregate batch-level metrics from Databricks SQL.
    """
    run_sql_async: RunSqlAsync
    tbl: TableRef
    sql_param: SqlParam

    def build_tree(self, rows: list[dict]) -> dict | None:
        """
        Convert flat lineage rows into a hierarchical tree structure.
        """
        return build_trace_tree(rows)

    async def fetch_trace_tree(
        self,
        token: str,
        material_id: str,
        batch_id: str,
        max_levels: int,
    ) -> list[dict]:
        """
        Perform a recursive CTE search to find all material lineage relationships.
        
        Args:
            token: Databricks access token.
            material_id: Root material ID.
            batch_id: Root batch ID.
            max_levels: Maximum depth for the recursive search.
            
        Returns:
            List of dictionaries representing nodes in the lineage graph.
        """
        bounded_levels = max(1, int(max_levels))
        query = f"""
            WITH RECURSIVE unique_edges AS (
              SELECT DISTINCT
                PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
                CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID, LINK_TYPE
              FROM {self.tbl("gold_batch_lineage")}
              WHERE CHILD_BATCH_ID IS NOT NULL
                AND LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER', 'STO_TRANSFER')
            ),
            production_plant AS (
              SELECT MAX(CHILD_PLANT_ID) AS PLANT_ID
              FROM {self.tbl("gold_batch_lineage")}
              WHERE CHILD_MATERIAL_ID = :mat
                AND CHILD_BATCH_ID = :bat
                AND LINK_TYPE = 'PRODUCTION'
            ),
            trace AS (
              SELECT
                CASE WHEN LINK_TYPE = 'PRODUCTION' THEN 2 ELSE 1 END AS trace_level,
                CHILD_MATERIAL_ID AS MATERIAL_ID,
                CHILD_BATCH_ID AS BATCH_ID,
                CHILD_PLANT_ID AS PLANT_ID,
                LINK_TYPE,
                PARENT_MATERIAL_ID,
                PARENT_BATCH_ID,
                CONCAT(',', CHILD_MATERIAL_ID, '|', CHILD_BATCH_ID, '|', CHILD_PLANT_ID, ',') AS path
              FROM unique_edges
              JOIN production_plant pp ON unique_edges.PARENT_PLANT_ID = pp.PLANT_ID
              WHERE PARENT_MATERIAL_ID = :mat AND PARENT_BATCH_ID = :bat
              UNION ALL
              SELECT
                t.trace_level + 1,
                e.CHILD_MATERIAL_ID,
                e.CHILD_BATCH_ID,
                e.CHILD_PLANT_ID,
                e.LINK_TYPE,
                e.PARENT_MATERIAL_ID,
                e.PARENT_BATCH_ID,
                CONCAT(t.path, e.CHILD_MATERIAL_ID, '|', e.CHILD_BATCH_ID, '|', e.CHILD_PLANT_ID, ',')
              FROM unique_edges e
              JOIN trace t
                ON e.PARENT_MATERIAL_ID = t.MATERIAL_ID
                AND e.PARENT_BATCH_ID = t.BATCH_ID
                AND e.PARENT_PLANT_ID = t.PLANT_ID
              WHERE t.trace_level < :max_levels
                AND INSTR(t.path, CONCAT(',', e.CHILD_MATERIAL_ID, '|', e.CHILD_BATCH_ID, '|', e.CHILD_PLANT_ID, ',')) = 0
            ),
            distinct_trace AS (
              SELECT DISTINCT
                trace_level, MATERIAL_ID, BATCH_ID, PLANT_ID, LINK_TYPE,
                PARENT_MATERIAL_ID, PARENT_BATCH_ID
              FROM trace
            ),
            all_nodes AS (
              SELECT
                0 AS depth,
                :mat AS material_id,
                :bat AS batch_id,
                CAST(NULL AS STRING) AS parent_material_id,
                CAST(NULL AS STRING) AS parent_batch_id,
                CAST(NULL AS STRING) AS plant_id
              UNION ALL
              SELECT
                dt.trace_level AS depth,
                dt.MATERIAL_ID AS material_id,
                dt.BATCH_ID AS batch_id,
                dt.PARENT_MATERIAL_ID AS parent_material_id,
                dt.PARENT_BATCH_ID AS parent_batch_id,
                dt.PLANT_ID AS plant_id
              FROM distinct_trace dt
            )
            SELECT DISTINCT
              n.material_id,
              n.batch_id,
              n.parent_material_id,
              n.parent_batch_id,
              m.MATERIAL_NAME AS material_description,
              n.depth,
              p.PLANT_NAME AS plant_name,
              CASE
                WHEN COALESCE(stk.BLOCKED, 0) > 0
                  OR COALESCE(qs.rejected_result_count, 0) > 0 THEN 'Blocked'
                WHEN COALESCE(stk.QUALITY_INSPECTION, 0) > 0
                  OR COALESCE(qs.failed_mic_count, 0) > 0 THEN 'QI Hold'
                WHEN COALESCE(qs.accepted_result_count, 0) > 0 THEN 'Released'
                WHEN COALESCE(stk.UNRESTRICTED, 0) > 0 THEN 'Released'
                ELSE 'Unknown'
              END AS release_status
            FROM all_nodes n
            LEFT JOIN {self.tbl("gold_material")} m
              ON m.MATERIAL_ID = n.material_id AND m.LANGUAGE_ID = 'E'
            LEFT JOIN {self.tbl("gold_plant")} p
              ON p.PLANT_ID = n.plant_id
            LEFT JOIN {self.tbl("gold_batch_quality_summary_v")} qs
              ON qs.MATERIAL_ID = n.material_id AND qs.BATCH_ID = n.batch_id
            LEFT JOIN (
              SELECT MATERIAL_ID, BATCH_ID,
                SUM(UNRESTRICTED) AS UNRESTRICTED,
                SUM(BLOCKED) AS BLOCKED,
                SUM(QUALITY_INSPECTION) AS QUALITY_INSPECTION,
                SUM(RESTRICTED) AS RESTRICTED
              FROM {self.tbl("gold_batch_stock_v")}
              GROUP BY MATERIAL_ID, BATCH_ID
            ) stk ON stk.MATERIAL_ID = n.material_id AND stk.BATCH_ID = n.batch_id
            ORDER BY n.depth, n.material_id
        """
        return await self.run_sql_async(
            token,
            query,
            [
                self.sql_param("mat", material_id),
                self.sql_param("bat", batch_id),
                self.sql_param("max_levels", bounded_levels),
            ],
        )

    async def fetch_summary(self, token: str, batch_id: str) -> dict | None:
        query = f"""
            WITH stk AS (
              SELECT
                SUM(UNRESTRICTED) AS current_stock_unrestricted,
                SUM(BLOCKED + RESTRICTED) AS current_stock_blocked,
                SUM(TOTAL_STOCK) AS actual_stock
              FROM {self.tbl('gold_batch_stock_v')}
              WHERE BATCH_ID = :batch_id
            ),
            mb AS (
              SELECT
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Production' THEN ABS_QUANTITY ELSE 0 END), 0) AS total_produced,
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment'   THEN ABS_QUANTITY ELSE 0 END), 0) AS total_shipped
              FROM {self.tbl('gold_batch_mass_balance_v')}
              WHERE BATCH_ID = :batch_id
                AND MOVEMENT_CATEGORY NOT LIKE 'STO%'
            )
            SELECT
              :batch_id AS batch_id,
              mb.total_produced,
              mb.total_shipped,
              COALESCE(stk.current_stock_unrestricted, 0) AS current_stock_unrestricted,
              COALESCE(stk.current_stock_blocked, 0) AS current_stock_blocked,
              COALESCE(stk.actual_stock, 0) AS actual_stock,
              COALESCE(stk.actual_stock, 0) -
                (mb.total_produced - mb.total_shipped) AS mass_balance_variance
            FROM mb CROSS JOIN stk
        """
        rows = await self.run_sql_async(token, query, [self.sql_param("batch_id", batch_id)])
        return rows[0] if rows else None

    async def fetch_batch_details(self, token: str, material_id: str, batch_id: str) -> dict:
        """
        Retrieve comprehensive details for a specific batch, including CoA,
        customer list, and movement history.
        """
        mat_batch = [self.sql_param("material_id", material_id), self.sql_param("batch_id", batch_id)]

        summary_query = f"""
            WITH stk AS (
              SELECT
                SUM(UNRESTRICTED) AS current_stock_unrestricted,
                SUM(BLOCKED + RESTRICTED) AS current_stock_blocked,
                SUM(TOTAL_STOCK) AS actual_stock
              FROM {self.tbl('gold_batch_stock_v')}
              WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
            ),
            mb AS (
              SELECT
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Production' THEN ABS_QUANTITY ELSE 0 END), 0) AS total_produced,
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment'   THEN ABS_QUANTITY ELSE 0 END), 0) AS total_shipped
              FROM {self.tbl('gold_batch_mass_balance_v')}
              WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
                AND MOVEMENT_CATEGORY NOT LIKE 'STO%'
            )
            SELECT
              :batch_id AS batch_id,
              mb.total_produced,
              mb.total_shipped,
              COALESCE(stk.current_stock_unrestricted, 0) AS current_stock_unrestricted,
              COALESCE(stk.current_stock_blocked, 0) AS current_stock_blocked,
              COALESCE(stk.actual_stock, 0) AS actual_stock,
              COALESCE(stk.actual_stock, 0) -
                (mb.total_produced - mb.total_shipped) AS mass_balance_variance
            FROM mb CROSS JOIN stk
        """
        coa_query = f"""
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
              END AS within_spec,
              CASE
                WHEN r.QUANTITATIVE_RESULT IS NOT NULL AND r.TARGET_VALUE IS NOT NULL
                THEN ROUND(r.QUANTITATIVE_RESULT - r.TARGET_VALUE, 4)
                ELSE NULL
              END AS deviation_from_target
            FROM {self.tbl('gold_batch_quality_result_v')} r
            LEFT JOIN {self.tbl('gold_batch_quality_lot_v')} l
              ON l.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
              AND l.MATERIAL_ID = r.MATERIAL_ID
              AND l.BATCH_ID = r.BATCH_ID
            WHERE r.MATERIAL_ID = :material_id AND r.BATCH_ID = :batch_id
            ORDER BY r.INSPECTION_LOT_ID, r.OPERATION_ID, r.MIC_ID, r.SAMPLE_ID
        """
        customer_query = f"""
            SELECT DISTINCT
              CUSTOMER_NAME AS customer_name,
              COUNTRY_NAME AS country
            FROM {self.tbl('gold_batch_delivery_v')}
            WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
              AND CUSTOMER_NAME IS NOT NULL
            ORDER BY customer_name, country
        """
        cross_query = f"""
            WITH inputs AS (
              SELECT DISTINCT
                PARENT_MATERIAL_ID AS input_mat,
                PARENT_BATCH_ID AS input_batch
              FROM {self.tbl('gold_batch_lineage')}
              WHERE CHILD_MATERIAL_ID = :material_id AND CHILD_BATCH_ID = :batch_id
                AND LINK_TYPE = 'PRODUCTION'
                AND PARENT_BATCH_ID IS NOT NULL
            ),
            exposed AS (
              SELECT DISTINCT
                bl.CHILD_BATCH_ID AS other_batch_id,
                i.input_mat AS shared_input_material
              FROM inputs i
              JOIN {self.tbl('gold_batch_lineage')} bl
                ON bl.PARENT_MATERIAL_ID = i.input_mat
                AND bl.PARENT_BATCH_ID = i.input_batch
                AND bl.LINK_TYPE = 'PRODUCTION'
              WHERE NOT (bl.CHILD_MATERIAL_ID = :material_id AND bl.CHILD_BATCH_ID = :batch_id)
            )
            SELECT
              other_batch_id,
              CONCAT_WS(', ', COLLECT_SET(shared_input_material)) AS shared_material_ids,
              CASE
                WHEN COUNT(DISTINCT shared_input_material) >= 3 THEN 'High'
                WHEN COUNT(DISTINCT shared_input_material) >= 2 THEN 'Medium'
                ELSE 'Low'
              END AS risk_level
            FROM exposed
            GROUP BY other_batch_id
            ORDER BY
              CASE
                WHEN COUNT(DISTINCT shared_input_material) >= 3 THEN 1
                WHEN COUNT(DISTINCT shared_input_material) >= 2 THEN 2
                ELSE 3
              END,
              other_batch_id
        """
        movement_query = f"""
            WITH daily_balance AS (
              SELECT
                POSTING_DATE,
                SUM(
                  CASE
                    WHEN MOVEMENT_TYPE = '261' THEN -ABS_QUANTITY
                    ELSE BALANCE_QTY
                  END
                ) AS daily_net
              FROM {self.tbl('gold_batch_mass_balance_v')}
              WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
                AND MOVEMENT_CATEGORY NOT LIKE 'STO%'
              GROUP BY POSTING_DATE
            ),
            running_balance AS (
              SELECT
                POSTING_DATE,
                SUM(daily_net) OVER (ORDER BY POSTING_DATE) AS inventory_level
              FROM daily_balance
            )
            SELECT POSTING_DATE, inventory_level
            FROM running_balance
            ORDER BY POSTING_DATE
        """

        summary_rows, coa_rows, customer_rows, cross_rows, movement_rows = await asyncio.gather(
            self.run_sql_async(token, summary_query, mat_batch),
            self.run_sql_async(token, coa_query, mat_batch),
            self.run_sql_async(token, customer_query, mat_batch),
            self.run_sql_async(token, cross_query, mat_batch),
            self.run_sql_async(token, movement_query, mat_batch),
        )

        return {
            "summary": summary_rows[0] if summary_rows else None,
            "coa_results": coa_rows,
            "customers": customer_rows,
            "cross_batch_exposure": cross_rows,
            "movement_history": movement_rows,
        }

    async def fetch_impact(self, token: str, batch_id: str) -> dict:
        batch_param = [self.sql_param("batch_id", batch_id)]
        customers_query = f"""
            SELECT DISTINCT
              CUSTOMER_NAME AS customer_name,
              COUNTRY_NAME AS country
            FROM {self.tbl('gold_batch_delivery_v')}
            WHERE BATCH_ID = :batch_id
              AND CUSTOMER_NAME IS NOT NULL
            ORDER BY customer_name, country
        """
        cross_query = f"""
            WITH inputs AS (
              SELECT DISTINCT
                PARENT_MATERIAL_ID AS input_mat,
                PARENT_BATCH_ID AS input_batch
              FROM {self.tbl('gold_batch_lineage')}
              WHERE CHILD_BATCH_ID = :batch_id
                AND LINK_TYPE = 'PRODUCTION'
                AND PARENT_BATCH_ID IS NOT NULL
            ),
            exposed AS (
              SELECT DISTINCT
                bl.CHILD_BATCH_ID AS other_batch_id,
                i.input_mat AS shared_input_material
              FROM inputs i
              JOIN {self.tbl('gold_batch_lineage')} bl
                ON bl.PARENT_MATERIAL_ID = i.input_mat
                AND bl.PARENT_BATCH_ID = i.input_batch
                AND bl.LINK_TYPE = 'PRODUCTION'
              WHERE bl.CHILD_BATCH_ID != :batch_id
            )
            SELECT
              other_batch_id,
              CONCAT_WS(', ', COLLECT_SET(shared_input_material)) AS shared_material_ids,
              CASE
                WHEN COUNT(DISTINCT shared_input_material) >= 3 THEN 'High'
                WHEN COUNT(DISTINCT shared_input_material) >= 2 THEN 'Medium'
                ELSE 'Low'
              END AS risk_level
            FROM exposed
            GROUP BY other_batch_id
            ORDER BY
              CASE risk_level
                WHEN 'High' THEN 3
                WHEN 'Medium' THEN 2
                WHEN 'Low' THEN 1
                ELSE 0
              END DESC,
              other_batch_id
        """

        customers_rows, cross_rows = await asyncio.gather(
            self.run_sql_async(token, customers_query, batch_param),
            self.run_sql_async(token, cross_query, batch_param),
        )

        return {
            "customers": customers_rows,
            "cross_batch_exposure": cross_rows,
        }
