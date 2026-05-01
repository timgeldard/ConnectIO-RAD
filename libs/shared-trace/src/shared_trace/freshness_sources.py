from __future__ import annotations

from shared_trace import schema

TRACE_TREE_FRESHNESS_SOURCES = (
    schema.GOLD_BATCH_LINEAGE,
    schema.GOLD_MATERIAL,
    schema.GOLD_PLANT,
    schema.GOLD_BATCH_QUALITY_SUMMARY_V,
    schema.GOLD_BATCH_STOCK_V,
)

SUMMARY_FRESHNESS_SOURCES = (
    schema.GOLD_BATCH_STOCK_V,
    schema.GOLD_BATCH_MASS_BALANCE_V,
)

BATCH_DETAILS_FRESHNESS_SOURCES = (
    schema.GOLD_BATCH_STOCK_V,
    schema.GOLD_BATCH_MASS_BALANCE_V,
    schema.GOLD_BATCH_QUALITY_RESULT_V,
    schema.GOLD_BATCH_QUALITY_LOT_V,
    schema.GOLD_BATCH_DELIVERY_V,
    schema.GOLD_BATCH_LINEAGE,
)

IMPACT_FRESHNESS_SOURCES = (
    schema.GOLD_BATCH_DELIVERY_V,
    schema.GOLD_BATCH_LINEAGE,
)

CORE_TRACE_FRESHNESS_SOURCES = {
    "trace": TRACE_TREE_FRESHNESS_SOURCES,
    "summary": SUMMARY_FRESHNESS_SOURCES,
    "batch_details": BATCH_DETAILS_FRESHNESS_SOURCES,
    "impact": IMPACT_FRESHNESS_SOURCES,
}

TRACE2_PAGE_FRESHNESS_SOURCES = {
    "coa": (
        schema.GOLD_BATCH_COA_RESULTS_V,
        schema.GOLD_BATCH_SUMMARY_V,
        schema.GOLD_BATCH_MASS_BALANCE_V,
        schema.GOLD_BATCH_STOCK_V,
        schema.GOLD_PLANT,
    ),
    "mass_balance": (
        schema.GOLD_BATCH_MASS_BALANCE_V,
        schema.GOLD_BATCH_SUMMARY_V,
        schema.GOLD_BATCH_STOCK_V,
        schema.GOLD_BATCH_DELIVERY_V,
        schema.GOLD_BATCH_LINEAGE,
        schema.GOLD_PLANT,
    ),
    "quality": (
        schema.GOLD_BATCH_QUALITY_LOT_V,
        schema.GOLD_BATCH_QUALITY_RESULT_V,
        schema.GOLD_BATCH_QUALITY_SUMMARY_V,
        schema.GOLD_BATCH_SUMMARY_V,
    ),
    "production_history": (
        schema.GOLD_BATCH_PRODUCTION_HISTORY_V,
        schema.GOLD_BATCH_SUMMARY_V,
    ),
    "batch_compare": (
        schema.GOLD_BATCH_PRODUCTION_HISTORY_V,
        schema.GOLD_BATCH_QUALITY_SUMMARY_V,
        schema.GOLD_BATCH_SUMMARY_V,
    ),
    "bottom_up": (
        schema.GOLD_BATCH_LINEAGE,
        schema.GOLD_MATERIAL,
        schema.GOLD_PLANT,
        schema.GOLD_SUPPLIER,
        schema.GOLD_BATCH_SUMMARY_V,
    ),
    "top_down": (
        schema.GOLD_BATCH_LINEAGE,
        schema.GOLD_MATERIAL,
        schema.GOLD_PLANT,
        schema.GOLD_BATCH_DELIVERY_V,
        schema.GOLD_BATCH_SUMMARY_V,
    ),
    "supplier_risk": (
        schema.GOLD_BATCH_LINEAGE,
        schema.GOLD_SUPPLIER,
        schema.GOLD_MATERIAL,
        schema.GOLD_BATCH_SUMMARY_V,
    ),
}
