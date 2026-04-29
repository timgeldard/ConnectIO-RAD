from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Optional

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
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Production' THEN BALANCE_QTY ELSE 0 END), 0) AS total_produced,
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment'   THEN -BALANCE_QTY ELSE 0 END), 0) AS total_shipped
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
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Production' THEN BALANCE_QTY ELSE 0 END), 0) AS total_produced,
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment'   THEN -BALANCE_QTY ELSE 0 END), 0) AS total_shipped
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

    def _batch_header_cte(self) -> str:
        return f"""
            WITH prod AS (
              SELECT * FROM {self.tbl('gold_batch_mass_balance_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND MOVEMENT_CATEGORY = 'Production'
            ),
            prod_agg AS (
              SELECT
                MAX_BY(PROCESS_ORDER_ID, POSTING_DATE) AS process_order,
                MAX_BY(PLANT_ID, POSTING_DATE) AS prod_plant_id,
                COALESCE(MAX(UOM), 'KG') AS uom,
                COALESCE(SUM(BALANCE_QTY), 0) AS qty_produced
              FROM prod
            ),
            mb_totals AS (
              SELECT
                COALESCE(SUM(CASE WHEN MOVEMENT_CATEGORY = 'Shipment' THEN -BALANCE_QTY ELSE 0 END), 0) AS qty_shipped,
                COALESCE(SUM(CASE WHEN MOVEMENT_TYPE IN ('261','262','201','202') THEN -BALANCE_QTY ELSE 0 END), 0) AS qty_consumed,
                COALESCE(SUM(CASE WHEN MOVEMENT_TYPE IN ('701','702','711','712','531','532') THEN BALANCE_QTY ELSE 0 END), 0) AS qty_adjusted
              FROM {self.tbl('gold_batch_mass_balance_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
                AND COALESCE(MOVEMENT_CATEGORY, '') NOT LIKE 'STO%'
            ),
            stk AS (
              SELECT
                COALESCE(SUM(UNRESTRICTED), 0) AS unrestricted,
                COALESCE(SUM(BLOCKED), 0) AS blocked,
                COALESCE(SUM(QUALITY_INSPECTION), 0) AS qi,
                COALESCE(SUM(RESTRICTED), 0) AS restricted,
                COALESCE(SUM(TRANSIT), 0) AS transit,
                COALESCE(SUM(TOTAL_STOCK), 0) AS current_stock,
                MAX(PLANT_ID) AS stk_plant_id
              FROM {self.tbl('gold_batch_stock_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
            ),
            del_unique AS (
              SELECT DISTINCT DELIVERY, CUSTOMER_ID, COUNTRY_ID, ABS_QUANTITY
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND DELIVERY IS NOT NULL
            ),
            del AS (
              SELECT
                COUNT(DISTINCT CUSTOMER_ID) AS customers_affected,
                COUNT(DISTINCT COUNTRY_ID) AS countries_affected,
                COALESCE(SUM(ABS_QUANTITY), 0) AS total_shipped_kg,
                COUNT(DISTINCT DELIVERY) AS total_deliveries
              FROM del_unique
            ),
            consuming AS (
              SELECT COUNT(DISTINCT PROCESS_ORDER_ID) AS consuming_pos
              FROM {self.tbl('gold_batch_lineage')}
              WHERE PARENT_MATERIAL_ID = :mat AND PARENT_BATCH_ID = :bat
                AND LINK_TYPE = 'PRODUCTION' AND PROCESS_ORDER_ID IS NOT NULL
            )
        """

    def _batch_header_select(self) -> str:
        return f"""
            SELECT
              :mat AS material_id, :bat AS batch_id,
              COALESCE(bs.MATERIAL_NAME, :mat) AS material_name,
              COALESCE(bs.MATERIAL_DESC_SHORT, SUBSTR(COALESCE(bs.MATERIAL_NAME, :mat), 1, 40)) AS material_desc40,
              COALESCE(pa.process_order, '') AS process_order,
              COALESCE(pa.prod_plant_id, stk.stk_plant_id, '') AS plant_id,
              COALESCE(p.PLANT_NAME, COALESCE(pa.prod_plant_id, stk.stk_plant_id, '')) AS plant_name,
              CAST(bs.MANUFACTURE_DATE AS STRING) AS manufacture_date,
              CAST(bs.SHELF_LIFE_EXPIRATION_DATE AS STRING) AS expiry_date,
              bs.days_to_expiry,
              bs.shelf_life_status,
              pa.uom,
              pa.qty_produced,
              mb_totals.qty_shipped,
              mb_totals.qty_consumed,
              mb_totals.qty_adjusted,
              stk.current_stock,
              stk.unrestricted, stk.blocked, stk.qi, stk.restricted, stk.transit,
              del.customers_affected, del.countries_affected, del.total_shipped_kg, del.total_deliveries,
              consuming.consuming_pos,
              CASE
                WHEN stk.blocked > 0 THEN 'BLOCKED'
                WHEN stk.qi > 0 THEN 'QUALITY_INSPECTION'
                WHEN stk.restricted > 0 THEN 'RESTRICTED'
                ELSE 'UNRESTRICTED'
              END AS batch_status
            FROM prod_agg pa
            CROSS JOIN mb_totals CROSS JOIN stk CROSS JOIN del CROSS JOIN consuming
            LEFT JOIN {self.tbl('gold_batch_summary_v')} bs
              ON bs.MATERIAL_ID = :mat AND bs.BATCH_ID = :bat
            LEFT JOIN {self.tbl('gold_plant')} p
              ON p.PLANT_ID = COALESCE(pa.prod_plant_id, stk.stk_plant_id)
        """

    async def fetch_batch_header(self, token: str, material_id: str, batch_id: str) -> Optional[dict]:
        query = self._batch_header_cte() + self._batch_header_select()
        rows = await self.run_sql_async(
            token,
            query,
            [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)],
        )
        return rows[0] if rows else None

    async def fetch_coa(self, token: str, material_id: str, batch_id: str) -> dict:
        params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        results_query = f"""
            SELECT
              mic_code,
              mic_name,
              target_value,
              tolerance_range,
              actual_result,
              result_status,
              within_spec,
              deviation_from_target
            FROM {self.tbl('gold_batch_coa_results_v')}
            WHERE batch_id = :bat
            ORDER BY mic_code
        """

        header_rows, result_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, params),
            self.run_sql_async(token, results_query, [self.sql_param("bat", batch_id)]),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "results": result_rows,
        }

    async def fetch_mass_balance(self, token: str, material_id: str, batch_id: str) -> dict:
        params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        events_query = f"""
            WITH events AS (
              SELECT
                POSTING_DATE,
                MOVEMENT_TYPE,
                MOVEMENT_CATEGORY,
                BALANCE_QTY AS delta
              FROM {self.tbl('gold_batch_mass_balance_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
                AND COALESCE(MOVEMENT_CATEGORY, '') NOT LIKE 'STO%'
            ),
            daily AS (
              SELECT POSTING_DATE,
                SUM(delta) AS daily_delta,
                MIN(MOVEMENT_TYPE) AS any_type,
                MIN(MOVEMENT_CATEGORY) AS any_category
              FROM events
              GROUP BY POSTING_DATE
            )
            SELECT
              CAST(POSTING_DATE AS STRING) AS date,
              COALESCE(any_category, '') AS category,
              COALESCE(any_type, '') AS type,
              daily_delta AS delta,
              SUM(daily_delta) OVER (ORDER BY POSTING_DATE) AS cum
            FROM daily
            ORDER BY POSTING_DATE
        """

        header_rows, event_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, params),
            self.run_sql_async(token, events_query, params),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "events": event_rows,
        }

    async def fetch_quality(self, token: str, material_id: str, batch_id: str) -> dict:
        params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        lots_query = f"""
            SELECT
              INSPECTION_LOT_ID AS lot,
              COALESCE(INSPECTION_TYPE, '') AS inspection_type,
              COALESCE(INSPECTION_SHORT_TEXT, '') AS description,
              CAST(CREATED_DATE AS STRING) AS start,
              CAST(INSPECTION_END_DATE AS STRING) AS end,
              COALESCE(CREATED_BY, '') AS inspector,
              COALESCE(INSPECTION_LOT_ORIGIN, '') AS origin,
              COALESCE(USAGE_DECISION_LONG_TEXT, '') AS decision
            FROM {self.tbl('gold_batch_quality_lot_v')}
            WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
            ORDER BY CREATED_DATE DESC, INSPECTION_LOT_ID
        """
        results_query = f"""
            SELECT
              INSPECTION_LOT_ID AS lot,
              MIC_ID AS mic_id,
              COALESCE(MIC_CODE, MIC_ID) AS mic_code,
              COALESCE(MIC_NAME, '') AS mic_name,
              TARGET_VALUE AS target_value,
              UPPER_TOLERANCE AS upper_tol,
              LOWER_TOLERANCE AS lower_tol,
              COALESCE(TOLERANCE, '') AS tolerance_text,
              COALESCE(UNIT_OF_MEASURE, '') AS uom,
              QUANTITATIVE_RESULT AS quantitative_result,
              COALESCE(QUALITATIVE_RESULT, '') AS qualitative_result,
              COALESCE(INSPECTION_RESULT_VALUATION, '') AS valuation,
              COALESCE(SAMPLE_ID, '') AS sample_id,
              COALESCE(INSPECTION_METHOD, '') AS method
        FROM {self.tbl('gold_batch_quality_result_v')}
        WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
        ORDER BY INSPECTION_LOT_ID, MIC_ID, SAMPLE_ID
    """
        summary_query = f"""
        SELECT
          COALESCE(MAX(lot_count), 0) AS lot_count,
          COALESCE(MAX(accepted_result_count), 0) AS accepted_result_count,
          COALESCE(MAX(rejected_result_count), 0) AS rejected_result_count,
          COALESCE(MAX(failed_mic_count), 0) AS failed_mic_count,
          CAST(MAX(latest_inspection_date) AS STRING) AS latest_inspection_date
        FROM {self.tbl('gold_batch_quality_summary_v')}
        WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
    """

        header_rows, lot_rows, result_rows, summary_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, params),
            self.run_sql_async(token, lots_query, params),
            self.run_sql_async(token, results_query, params),
            self.run_sql_async(token, summary_query, params),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "lots": lot_rows,
            "results": result_rows,
            "summary": summary_rows[0] if summary_rows else None,
        }

    async def fetch_production_history(self, token: str, material_id: str, batch_id: str, limit: int = 24) -> dict:
        params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        prod_query = f"""
            SELECT
              PROCESS_ORDER_ID AS process_order,
              BATCH_ID AS batch_id,
              PLANT_ID AS plant_id,
              CAST(POSTING_DATE AS STRING) AS date,
              CAST(BATCH_QTY AS DOUBLE) AS qty,
              COALESCE(UOM, 'KG') AS uom,
              COALESCE(quality_status, '') AS quality_status
            FROM {self.tbl('gold_batch_production_history_v')}
            WHERE MATERIAL_ID = :mat
            ORDER BY POSTING_DATE DESC
            LIMIT CAST(:lim AS INT)
        """

        header_rows, prod_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, params),
            self.run_sql_async(
                token,
                prod_query,
                [self.sql_param("mat", material_id), self.sql_param("lim", str(limit))],
            ),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "batches": prod_rows,
        }

    async def fetch_batch_compare(self, token: str, material_id: str, batch_id: str, limit: int = 24) -> dict:
        params_mat = [self.sql_param("mat", material_id), self.sql_param("lim", str(limit))]
        header_params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        compare_query = f"""
            WITH prod AS (
              SELECT PROCESS_ORDER_ID, BATCH_ID, PLANT_ID, POSTING_DATE, BATCH_QTY, UOM, quality_status
              FROM {self.tbl('gold_batch_production_history_v')}
              WHERE MATERIAL_ID = :mat
              ORDER BY POSTING_DATE DESC
              LIMIT CAST(:lim AS INT)
            )
            SELECT
              p.PROCESS_ORDER_ID AS process_order,
              p.BATCH_ID AS batch_id,
              p.PLANT_ID AS plant_id,
              CAST(p.POSTING_DATE AS STRING) AS date,
              CAST(p.BATCH_QTY AS DOUBLE) AS qty,
              COALESCE(p.UOM, 'KG') AS uom,
              COALESCE(p.quality_status, '') AS quality_status,
              COALESCE(q.lot_count, 0) AS lot_count,
              COALESCE(q.accepted_result_count, 0) AS accepted,
              COALESCE(q.rejected_result_count, 0) AS rejected,
              COALESCE(q.failed_mic_count, 0) AS failed_mics
            FROM prod p
            LEFT JOIN {self.tbl('gold_batch_quality_summary_v')} q
              ON q.MATERIAL_ID = :mat AND q.BATCH_ID = p.BATCH_ID
            ORDER BY p.POSTING_DATE DESC
        """

        header_rows, compare_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, header_params),
            self.run_sql_async(token, compare_query, params_mat),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "batches": compare_rows,
        }

    async def fetch_bottom_up(self, token: str, material_id: str, batch_id: str, max_levels: int = 4) -> dict:
        params = [
            self.sql_param("mat", material_id),
            self.sql_param("bat", batch_id),
            self.sql_param("max_levels", str(max(1, max_levels))),
        ]
        header_query = self._batch_header_cte() + self._batch_header_select()
        lineage_query = f"""
            WITH RECURSIVE walk AS (
              SELECT 1 AS level,
                PARENT_MATERIAL_ID AS material_id,
                PARENT_BATCH_ID AS batch_id,
                PARENT_PLANT_ID AS plant_id,
                LINK_TYPE AS link,
                SUPPLIER_ID AS supplier_id,
                QUANTITY AS qty,
                BASE_UNIT_OF_MEASURE AS uom,
                CHILD_MATERIAL_ID AS parent_material_id,
                CHILD_BATCH_ID AS parent_batch_id,
                CHILD_PLANT_ID AS parent_plant_id,
                CONCAT(',', :mat, '|', :bat, '@', COALESCE(CHILD_PLANT_ID, ''), ',',
                       PARENT_MATERIAL_ID, '|', PARENT_BATCH_ID, '@', COALESCE(PARENT_PLANT_ID, ''), ',') AS path
              FROM {self.tbl('gold_batch_lineage')}
              WHERE CHILD_MATERIAL_ID = :mat AND CHILD_BATCH_ID = :bat
                AND PARENT_BATCH_ID IS NOT NULL
              UNION ALL
              SELECT w.level + 1,
                e.PARENT_MATERIAL_ID,
                e.PARENT_BATCH_ID,
                e.PARENT_PLANT_ID,
                e.LINK_TYPE,
                e.SUPPLIER_ID,
                e.QUANTITY,
                e.BASE_UNIT_OF_MEASURE,
                e.CHILD_MATERIAL_ID,
                e.CHILD_BATCH_ID,
                e.CHILD_PLANT_ID,
                CONCAT(w.path, e.PARENT_MATERIAL_ID, '|', e.PARENT_BATCH_ID, '@', COALESCE(e.PARENT_PLANT_ID, ''), ',')
              FROM {self.tbl('gold_batch_lineage')} e
              JOIN walk w
                ON e.CHILD_MATERIAL_ID = w.material_id
               AND e.CHILD_BATCH_ID = w.batch_id
               AND COALESCE(e.CHILD_PLANT_ID, '') = COALESCE(w.plant_id, '')
              WHERE w.level < :max_levels
                AND e.PARENT_BATCH_ID IS NOT NULL
                AND INSTR(w.path, CONCAT(',', e.PARENT_MATERIAL_ID, '|', e.PARENT_BATCH_ID, '@', COALESCE(e.PARENT_PLANT_ID, ''), ',')) = 0
            ),
            agg AS (
              SELECT material_id, batch_id, plant_id,
                MIN(level) AS level,
                MIN(link) AS link,
                MIN(NULLIF(supplier_id, '')) AS supplier_id,
                SUM(qty) AS qty,
                MIN(uom) AS uom,
                MIN(parent_material_id) AS parent_material_id,
                MIN(parent_batch_id) AS parent_batch_id,
                MIN(parent_plant_id) AS parent_plant_id
              FROM walk
              GROUP BY material_id, batch_id, plant_id
            )
            SELECT
              a.level,
              a.material_id,
              COALESCE(m.MATERIAL_NAME, a.material_id) AS material,
              a.batch_id AS batch,
              COALESCE(a.plant_id, '') AS plant_id,
              COALESCE(p.PLANT_NAME, a.plant_id, '') AS plant,
              COALESCE(a.qty, 0) AS qty,
              COALESCE(a.uom, 'KG') AS uom,
              COALESCE(s.SUPPLIER_NAME, a.supplier_id, '') AS supplier,
              a.link,
              a.parent_material_id,
              a.parent_batch_id,
              COALESCE(a.parent_plant_id, '') AS parent_plant_id
            FROM agg a
            LEFT JOIN {self.tbl('gold_material')} m
              ON m.MATERIAL_ID = a.material_id AND m.LANGUAGE_ID = 'E'
            LEFT JOIN {self.tbl('gold_plant')} p
              ON p.PLANT_ID = a.plant_id
            LEFT JOIN {self.tbl('gold_supplier')} s
              ON s.SUPPLIER_ID = a.supplier_id
            ORDER BY a.level, a.material_id
        """

        header_rows, lineage_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]),
            self.run_sql_async(token, lineage_query, params),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "lineage": lineage_rows,
        }

    async def fetch_top_down(self, token: str, material_id: str, batch_id: str, max_levels: int = 4) -> dict:
        params = [
            self.sql_param("mat", material_id),
            self.sql_param("bat", batch_id),
            self.sql_param("max_levels", str(max(1, max_levels))),
        ]
        header_query = self._batch_header_cte() + self._batch_header_select()
        lineage_query = f"""
            WITH RECURSIVE walk AS (
              SELECT 1 AS level,
                CHILD_MATERIAL_ID AS material_id,
                CHILD_BATCH_ID AS batch_id,
                CHILD_PLANT_ID AS plant_id,
                LINK_TYPE AS link,
                CUSTOMER_ID AS customer_id,
                QUANTITY AS qty,
                BASE_UNIT_OF_MEASURE AS uom,
                PARENT_MATERIAL_ID AS parent_material_id,
                PARENT_BATCH_ID AS parent_batch_id,
                PARENT_PLANT_ID AS parent_plant_id,
                CONCAT(',', PARENT_MATERIAL_ID, '|', PARENT_BATCH_ID, '@', COALESCE(PARENT_PLANT_ID, ''), ',', CHILD_MATERIAL_ID, '|', CHILD_BATCH_ID, '@', COALESCE(CHILD_PLANT_ID, ''), ',') AS path
              FROM {self.tbl('gold_batch_lineage')}
              WHERE PARENT_MATERIAL_ID = :mat AND PARENT_BATCH_ID = :bat
                AND CHILD_BATCH_ID IS NOT NULL
                AND LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER', 'STO_TRANSFER')
              UNION ALL
              SELECT w.level + 1,
                e.CHILD_MATERIAL_ID,
                e.CHILD_BATCH_ID,
                e.CHILD_PLANT_ID,
                e.LINK_TYPE,
                e.CUSTOMER_ID,
                e.QUANTITY,
                e.BASE_UNIT_OF_MEASURE,
                e.PARENT_MATERIAL_ID,
                e.PARENT_BATCH_ID,
                e.PARENT_PLANT_ID,
                CONCAT(w.path, e.CHILD_MATERIAL_ID, '|', e.CHILD_BATCH_ID, '@', COALESCE(e.CHILD_PLANT_ID, ''), ',')
              FROM {self.tbl('gold_batch_lineage')} e
              JOIN walk w
                ON e.PARENT_MATERIAL_ID = w.material_id
               AND e.PARENT_BATCH_ID = w.batch_id
               AND COALESCE(e.PARENT_PLANT_ID, '') = COALESCE(w.plant_id, '')
              WHERE w.level < :max_levels
                AND e.CHILD_BATCH_ID IS NOT NULL
                AND e.LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER', 'STO_TRANSFER')
                AND INSTR(w.path, CONCAT(',', e.CHILD_MATERIAL_ID, '|', e.CHILD_BATCH_ID, '@', COALESCE(e.CHILD_PLANT_ID, ''), ',')) = 0
            ),
            agg AS (
              SELECT material_id, batch_id, plant_id,
                MIN(level) AS level,
                MIN(link) AS link,
                MIN(NULLIF(customer_id, '')) AS customer_id,
                SUM(qty) AS qty,
                MIN(uom) AS uom,
                MIN(parent_material_id) AS parent_material_id,
                MIN(parent_batch_id) AS parent_batch_id,
                MIN(parent_plant_id) AS parent_plant_id
              FROM walk
              WHERE material_id IS NOT NULL AND batch_id IS NOT NULL
              GROUP BY material_id, batch_id, plant_id
            )
            SELECT
              a.level,
              a.material_id,
              COALESCE(m.MATERIAL_NAME, a.material_id) AS material,
              a.batch_id AS batch,
              COALESCE(a.plant_id, '') AS plant_id,
              COALESCE(p.PLANT_NAME, a.plant_id, '') AS plant,
              COALESCE(a.qty, 0) AS qty,
              COALESCE(a.uom, 'KG') AS uom,
              COALESCE(a.customer_id, '') AS customer,
              a.link,
              a.parent_material_id,
              a.parent_batch_id,
              COALESCE(a.parent_plant_id, '') AS parent_plant_id
            FROM agg a
            LEFT JOIN {self.tbl('gold_material')} m
              ON m.MATERIAL_ID = a.material_id AND m.LANGUAGE_ID = 'E'
            LEFT JOIN {self.tbl('gold_plant')} p
              ON p.PLANT_ID = a.plant_id
            ORDER BY a.level, a.material_id
        """

        del_params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        countries_query = f"""
            WITH per_delivery AS (
              SELECT DISTINCT DELIVERY, COUNTRY_ID, COUNTRY_NAME, ABS_QUANTITY
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND COUNTRY_ID IS NOT NULL
            )
            SELECT
              COUNTRY_ID AS code,
              COALESCE(MAX(COUNTRY_NAME), COUNTRY_ID) AS name,
              COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
              COUNT(DISTINCT DELIVERY) AS deliveries
            FROM per_delivery
            GROUP BY COUNTRY_ID
            ORDER BY qty DESC
        """
        customers_query = f"""
            WITH per_delivery AS (
              SELECT DISTINCT DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, ABS_QUANTITY
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND CUSTOMER_ID IS NOT NULL
            ),
            per_cust AS (
              SELECT CUSTOMER_ID AS id,
                MAX(CUSTOMER_NAME) AS name,
                MAX(COUNTRY_ID) AS country,
                COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
                COUNT(DISTINCT DELIVERY) AS deliveries
              FROM per_delivery
              GROUP BY CUSTOMER_ID
            ),
            grand AS (
              SELECT NULLIF(SUM(qty), 0) AS total_qty FROM per_cust
            )
            SELECT
              pc.id, pc.name, pc.country, pc.qty, pc.deliveries,
              CASE WHEN g.total_qty IS NULL THEN 0 ELSE pc.qty / g.total_qty END AS share
            FROM per_cust pc CROSS JOIN grand g
            ORDER BY pc.qty DESC
        """
        deliveries_query = f"""
            WITH per_delivery AS (
              SELECT DISTINCT
                DELIVERY, CUSTOMER_NAME, CITY, COUNTRY_ID, POSTING_DATE,
                ABS_QUANTITY, SALES_ORDER_ID
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND DELIVERY IS NOT NULL
            )
            SELECT
              DELIVERY AS delivery,
              COALESCE(MAX(CUSTOMER_NAME), '(unknown)') AS customer,
              COALESCE(MAX(CITY), '') AS destination,
              COALESCE(MAX(COUNTRY_ID), '') AS country,
              CAST(MAX(POSTING_DATE) AS STRING) AS date,
              COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
              COALESCE(MAX(SALES_ORDER_ID), '') AS doc,
              CASE
                WHEN MAX(POSTING_DATE) > CURRENT_DATE() THEN 'PLANNED'
                WHEN MAX(POSTING_DATE) = CURRENT_DATE() THEN 'IN_TRANSIT'
                ELSE 'DELIVERED'
              END AS status
            FROM per_delivery
            GROUP BY DELIVERY
            ORDER BY date, delivery
        """

        header_rows, lineage_rows, countries_rows, customers_rows, deliveries_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, del_params),
            self.run_sql_async(token, lineage_query, params),
            self.run_sql_async(token, countries_query, del_params),
            self.run_sql_async(token, customers_query, del_params),
            self.run_sql_async(token, deliveries_query, del_params),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "lineage": lineage_rows,
            "countries": countries_rows,
            "customers": customers_rows,
            "deliveries": deliveries_rows,
        }

    async def fetch_recall_readiness(self, token: str, material_id: str, batch_id: str) -> dict:
        params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        countries_query = f"""
            WITH per_delivery AS (
              SELECT DISTINCT DELIVERY, COUNTRY_ID, COUNTRY_NAME, ABS_QUANTITY
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
                AND COUNTRY_ID IS NOT NULL
            )
            SELECT
              COUNTRY_ID AS code,
              COALESCE(MAX(COUNTRY_NAME), COUNTRY_ID) AS name,
              COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
              COUNT(DISTINCT DELIVERY) AS deliveries
            FROM per_delivery
            GROUP BY COUNTRY_ID
            ORDER BY qty DESC
        """

        customers_query = f"""
            WITH per_delivery AS (
              SELECT DISTINCT DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, ABS_QUANTITY
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
                AND CUSTOMER_ID IS NOT NULL
            ),
            per_cust AS (
              SELECT
                CUSTOMER_ID AS id,
                MAX(CUSTOMER_NAME) AS name,
                MAX(COUNTRY_ID) AS country,
                COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
                COUNT(DISTINCT DELIVERY) AS deliveries
              FROM per_delivery
              GROUP BY CUSTOMER_ID
            ),
            grand AS (
              SELECT NULLIF(SUM(qty), 0) AS total_qty FROM per_cust
            )
            SELECT
              pc.id, pc.name, pc.country, pc.qty, pc.deliveries,
              CASE WHEN g.total_qty IS NULL THEN 0 ELSE pc.qty / g.total_qty END AS share
            FROM per_cust pc CROSS JOIN grand g
            ORDER BY pc.qty DESC
        """

        deliveries_query = f"""
            WITH per_delivery AS (
              SELECT DISTINCT
                DELIVERY, CUSTOMER_NAME, CITY, COUNTRY_ID, POSTING_DATE,
                ABS_QUANTITY, SALES_ORDER_ID
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND DELIVERY IS NOT NULL
            )
            SELECT
              DELIVERY AS delivery,
              COALESCE(MAX(CUSTOMER_NAME), '(unknown)') AS customer,
              COALESCE(MAX(CITY), '') AS destination,
              COALESCE(MAX(COUNTRY_ID), '') AS country,
              CAST(MAX(POSTING_DATE) AS STRING) AS date,
              COALESCE(SUM(ABS_QUANTITY), 0) AS qty,
              COALESCE(MAX(SALES_ORDER_ID), '') AS doc,
              CASE
                WHEN MAX(POSTING_DATE) > CURRENT_DATE() THEN 'PLANNED'
                WHEN MAX(POSTING_DATE) = CURRENT_DATE() THEN 'IN_TRANSIT'
                ELSE 'DELIVERED'
              END AS status
            FROM per_delivery
            GROUP BY DELIVERY
            ORDER BY date, delivery
        """

        exposure_query = f"""
            WITH RECURSIVE trace AS (
              SELECT 1 AS depth,
                CHILD_MATERIAL_ID AS material_id,
                CHILD_BATCH_ID AS batch_id,
                CHILD_PLANT_ID AS plant_id
              FROM {self.tbl('gold_batch_lineage')}
              WHERE PARENT_MATERIAL_ID = :mat AND PARENT_BATCH_ID = :bat
                AND CHILD_BATCH_ID IS NOT NULL
                AND LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER')
              UNION ALL
              SELECT t.depth + 1,
                e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID
              FROM {self.tbl('gold_batch_lineage')} e
              JOIN trace t
                ON e.PARENT_MATERIAL_ID = t.material_id
                AND e.PARENT_BATCH_ID = t.batch_id
              WHERE t.depth < 2
                AND e.CHILD_BATCH_ID IS NOT NULL
                AND e.LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER')
            ),
            distinct_trace AS (
              SELECT material_id, batch_id,
                MIN(plant_id) AS plant_id,
                MIN(depth) AS depth
              FROM trace
              GROUP BY material_id, batch_id
            )
            SELECT
              dt.material_id,
              COALESCE(m.MATERIAL_NAME, dt.material_id) AS material,
              dt.batch_id AS batch,
              COALESCE(dt.plant_id, '') AS plant,
              COALESCE(mb.qty_produced, 0) AS qty,
              COALESCE(stk.current_stock, 0) AS stock,
              COALESCE(del.total_shipped, 0) AS shipped,
              CASE
                WHEN COALESCE(stk.blocked_v, 0) > 0 THEN 'BLOCKED'
                WHEN COALESCE(stk.qi_v, 0) > 0 THEN 'QUALITY_INSPECTION'
                WHEN COALESCE(stk.restricted_v, 0) > 0 THEN 'RESTRICTED'
                ELSE 'UNRESTRICTED'
              END AS status,
              dt.depth AS path_depth,
              CASE
                WHEN dt.depth = 1 THEN 'CRITICAL'
                WHEN dt.depth = 2 AND COALESCE(del.total_shipped, 0) > 0 THEN 'HIGH'
                WHEN dt.depth = 2 THEN 'MEDIUM'
                ELSE 'LOW'
              END AS risk
            FROM distinct_trace dt
            LEFT JOIN {self.tbl('gold_material')} m
              ON m.MATERIAL_ID = dt.material_id AND m.LANGUAGE_ID = 'E'
            LEFT JOIN (
              SELECT MATERIAL_ID, BATCH_ID,
                SUM(UNRESTRICTED) AS unrestricted_v,
                SUM(BLOCKED) AS blocked_v,
                SUM(QUALITY_INSPECTION) AS qi_v,
                SUM(RESTRICTED) AS restricted_v,
                SUM(TOTAL_STOCK) AS current_stock
              FROM {self.tbl('gold_batch_stock_mat')}
              WHERE (MATERIAL_ID, BATCH_ID) IN (SELECT material_id, batch_id FROM distinct_trace)
              GROUP BY MATERIAL_ID, BATCH_ID
            ) stk ON stk.MATERIAL_ID = dt.material_id AND stk.BATCH_ID = dt.batch_id
            LEFT JOIN (
              SELECT MATERIAL_ID, BATCH_ID,
                SUM(CASE WHEN MOVEMENT_CATEGORY = 'Production' THEN BALANCE_QTY ELSE 0 END) AS qty_produced
              FROM {self.tbl('gold_batch_mass_balance_mat')}
              WHERE (MATERIAL_ID, BATCH_ID) IN (SELECT material_id, batch_id FROM distinct_trace)
              GROUP BY MATERIAL_ID, BATCH_ID
            ) mb ON mb.MATERIAL_ID = dt.material_id AND mb.BATCH_ID = dt.batch_id
            LEFT JOIN (
              SELECT MATERIAL_ID, BATCH_ID, SUM(ABS_QUANTITY) AS total_shipped
              FROM (
                SELECT DISTINCT MATERIAL_ID, BATCH_ID, DELIVERY, ABS_QUANTITY
                FROM {self.tbl('gold_batch_delivery_mat')}
                WHERE (MATERIAL_ID, BATCH_ID) IN (SELECT material_id, batch_id FROM distinct_trace)
              ) dv
              GROUP BY MATERIAL_ID, BATCH_ID
            ) del ON del.MATERIAL_ID = dt.material_id AND del.BATCH_ID = dt.batch_id
            ORDER BY dt.depth, dt.material_id
        """

        events_query = f"""
            WITH mb_events AS (
              SELECT DISTINCT
                POSTING_DATE, MOVEMENT_TYPE, PLANT_ID, BALANCE_QTY, UOM, PROCESS_ORDER_ID
              FROM {self.tbl('gold_batch_mass_balance_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat
                AND (
                  MOVEMENT_CATEGORY = 'Production'
                  OR MOVEMENT_TYPE IN ('261','262','201','202','701','702','711','712','531','532')
                )
            ),
            del_events AS (
              SELECT DISTINCT
                POSTING_DATE, MOVEMENT_TYPE, PLANT_ID, ABS_QUANTITY, UOM,
                CUSTOMER_NAME, COUNTRY_ID, DELIVERY
              FROM {self.tbl('gold_batch_delivery_mat')}
              WHERE MATERIAL_ID = :mat AND BATCH_ID = :bat AND DELIVERY IS NOT NULL
            ),
            combined AS (
              SELECT
                CAST(POSTING_DATE AS STRING) AS date,
                CASE
                  WHEN MOVEMENT_TYPE IN ('101','102') THEN 'PRODUCTION'
                  WHEN MOVEMENT_TYPE IN ('261','262','201','202') THEN 'CONSUMPTION'
                  WHEN MOVEMENT_TYPE IN ('701','702','711','712','531','532') THEN 'ADJUSTMENT'
                  ELSE 'ADJUSTMENT'
                END AS category,
                COALESCE(MOVEMENT_TYPE, '') AS type,
                COALESCE(PLANT_ID, '') AS plant,
                BALANCE_QTY AS qty,
                COALESCE(UOM, 'KG') AS uom,
                CAST(NULL AS STRING) AS customer,
                CAST(NULL AS STRING) AS country,
                COALESCE(PROCESS_ORDER_ID, '') AS doc
              FROM mb_events
              UNION ALL
              SELECT
                CAST(POSTING_DATE AS STRING) AS date,
                'SALES_ISSUE' AS category,
                COALESCE(MOVEMENT_TYPE, '') AS type,
                COALESCE(PLANT_ID, '') AS plant,
                -ABS_QUANTITY AS qty,
                COALESCE(UOM, 'KG') AS uom,
                CUSTOMER_NAME AS customer,
                COUNTRY_ID AS country,
                COALESCE(DELIVERY, '') AS doc
              FROM del_events
            )
            SELECT date, category, type, plant, qty, uom, customer, country, doc
            FROM combined
            ORDER BY date, category
        """

        header_rows, countries_rows, customers_rows, deliveries_rows, exposure_rows, events_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, params),
            self.run_sql_async(token, countries_query, params),
            self.run_sql_async(token, customers_query, params),
            self.run_sql_async(token, deliveries_query, params),
            self.run_sql_async(token, exposure_query, params),
            self.run_sql_async(token, events_query, params),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "countries": countries_rows,
            "customers": customers_rows,
            "deliveries": deliveries_rows,
            "exposure": exposure_rows,
            "events": events_rows,
        }

    async def fetch_supplier_risk(self, token: str, material_id: str, batch_id: str) -> dict:
        """Aggregate suppliers that fed (directly or through lineage) into this batch."""
        del_params = [self.sql_param("mat", material_id), self.sql_param("bat", batch_id)]
        header_query = self._batch_header_cte() + self._batch_header_select()
        max_depth = "4"
        suppliers_query = f"""
            WITH RECURSIVE upstream AS (
              SELECT
                :mat AS material_id,
                :bat AS batch_id,
                0 AS level,
                CONCAT(',', :mat, '|', :bat, ',') AS path
              UNION ALL
              SELECT
                l.PARENT_MATERIAL_ID AS material_id,
                l.PARENT_BATCH_ID AS batch_id,
                u.level + 1,
                CONCAT(u.path, l.PARENT_MATERIAL_ID, '|', l.PARENT_BATCH_ID, ',')
              FROM {self.tbl('gold_batch_lineage')} l
              JOIN upstream u
                ON l.CHILD_MATERIAL_ID = u.material_id
               AND l.CHILD_BATCH_ID = u.batch_id
              WHERE u.level < {max_depth}
                AND l.LINK_TYPE IN ('PRODUCTION', 'BATCH_TRANSFER')
                AND l.PARENT_MATERIAL_ID IS NOT NULL
                AND l.PARENT_BATCH_ID IS NOT NULL
                AND INSTR(u.path, CONCAT(',', l.PARENT_MATERIAL_ID, '|', l.PARENT_BATCH_ID, ',')) = 0
            ),
            ancestor_set AS (
              SELECT DISTINCT material_id, batch_id FROM upstream
            ),
            receipts AS (
              SELECT DISTINCT
                l.SUPPLIER_ID AS supplier_id,
                l.CHILD_MATERIAL_ID AS material_id,
                l.CHILD_BATCH_ID AS batch_id,
                CAST(l.POSTING_DATE AS DATE) AS posting_date,
                l.QUANTITY AS qty
              FROM {self.tbl('gold_batch_lineage')} l
              JOIN ancestor_set a
                ON a.material_id = l.CHILD_MATERIAL_ID
               AND a.batch_id = l.CHILD_BATCH_ID
              WHERE l.LINK_TYPE = 'VENDOR_RECEIPT'
                AND l.SUPPLIER_ID IS NOT NULL
                AND l.SUPPLIER_ID != ''
            ),
            quality_agg AS (
              SELECT
                r.supplier_id,
                COALESCE(SUM(q.accepted_result_count), 0) AS accepted,
                COALESCE(SUM(q.rejected_result_count), 0) AS rejected,
                COALESCE(SUM(q.failed_mic_count), 0) AS failed_mics
              FROM receipts r
              LEFT JOIN {self.tbl('gold_batch_quality_summary_v')} q
                ON q.MATERIAL_ID = r.material_id AND q.BATCH_ID = r.batch_id
              GROUP BY r.supplier_id
            ),
            agg AS (
              SELECT
                supplier_id,
                COUNT(DISTINCT material_id) AS material_count,
                MIN(material_id) AS any_material_id,
                COALESCE(SUM(qty), 0) AS received,
                COUNT(DISTINCT batch_id) AS batches,
                CAST(MIN(posting_date) AS STRING) AS first_date,
                CAST(MAX(posting_date) AS STRING) AS last_date
              FROM receipts
              GROUP BY supplier_id
            )
            SELECT
              a.supplier_id AS id,
              COALESCE(s.SUPPLIER_NAME, a.supplier_id) AS name,
              COALESCE(s.COUNTRY_ID, '') AS country,
              COALESCE(m.MATERIAL_NAME, a.any_material_id, '') AS material,
              a.received,
              a.batches,
              a.first_date AS first,
              a.last_date AS last,
              COALESCE(qa.accepted, 0) AS accepted_results,
              COALESCE(qa.rejected, 0) AS rejected_results,
              COALESCE(qa.failed_mics, 0) AS failed_mics,
              CASE
                WHEN COALESCE(qa.accepted, 0) + COALESCE(qa.rejected, 0) > 0
                  THEN CAST(qa.rejected AS DOUBLE)
                       / (CAST(qa.accepted AS DOUBLE) + CAST(qa.rejected AS DOUBLE))
                ELSE 0.0
              END AS failure_rate
            FROM agg a
            LEFT JOIN quality_agg qa ON qa.supplier_id = a.supplier_id
            LEFT JOIN {self.tbl('gold_supplier')} s ON s.SUPPLIER_ID = a.supplier_id
            LEFT JOIN {self.tbl('gold_material')} m
              ON m.MATERIAL_ID = a.any_material_id AND m.LANGUAGE_ID = 'E'
            ORDER BY a.received DESC
            LIMIT 50
        """

        header_rows, supplier_rows = await asyncio.gather(
            self.run_sql_async(token, header_query, del_params),
            self.run_sql_async(token, suppliers_query, del_params),
        )

        return {
            "header": header_rows[0] if header_rows else None,
            "suppliers": supplier_rows,
        }
