from __future__ import annotations

TRACE_TREE_FRESHNESS_SOURCES = (
    "gold_batch_lineage",
    "gold_material",
    "gold_plant",
    "gold_batch_quality_summary_v",
    "gold_batch_stock_v",
)

SUMMARY_FRESHNESS_SOURCES = (
    "gold_batch_stock_v",
    "gold_batch_mass_balance_v",
)

BATCH_DETAILS_FRESHNESS_SOURCES = (
    "gold_batch_stock_v",
    "gold_batch_mass_balance_v",
    "gold_batch_quality_result_v",
    "gold_batch_quality_lot_v",
    "gold_batch_delivery_v",
    "gold_batch_lineage",
)

IMPACT_FRESHNESS_SOURCES = (
    "gold_batch_delivery_v",
    "gold_batch_lineage",
)

CORE_TRACE_FRESHNESS_SOURCES = {
    "trace": TRACE_TREE_FRESHNESS_SOURCES,
    "summary": SUMMARY_FRESHNESS_SOURCES,
    "batch_details": BATCH_DETAILS_FRESHNESS_SOURCES,
    "impact": IMPACT_FRESHNESS_SOURCES,
}

TRACE2_PAGE_FRESHNESS_SOURCES = {
    "coa": (
        "gold_batch_coa_results_v",
        "gold_batch_summary_v",
        "gold_batch_mass_balance_v",
        "gold_batch_stock_v",
        "gold_plant",
    ),
    "mass_balance": (
        "gold_batch_mass_balance_v",
        "gold_batch_summary_v",
        "gold_batch_stock_v",
        "gold_batch_delivery_v",
        "gold_batch_lineage",
        "gold_plant",
    ),
    "quality": (
        "gold_batch_quality_lot_v",
        "gold_batch_quality_result_v",
        "gold_batch_quality_summary_v",
        "gold_batch_summary_v",
    ),
    "production_history": (
        "gold_batch_production_history_v",
        "gold_batch_summary_v",
    ),
    "batch_compare": (
        "gold_batch_production_history_v",
        "gold_batch_quality_summary_v",
        "gold_batch_summary_v",
    ),
    "bottom_up": (
        "gold_batch_lineage",
        "gold_material",
        "gold_plant",
        "gold_supplier",
        "gold_batch_summary_v",
    ),
    "top_down": (
        "gold_batch_lineage",
        "gold_material",
        "gold_plant",
        "gold_batch_delivery_v",
        "gold_batch_summary_v",
    ),
    "supplier_risk": (
        "gold_batch_lineage",
        "gold_supplier",
        "gold_material",
        "gold_batch_summary_v",
    ),
}
