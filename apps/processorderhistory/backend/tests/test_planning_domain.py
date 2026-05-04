"""Domain tests for production planning projections."""

from backend.production_planning.domain.planning import build_kpis, coerce_backlog, coerce_block

NOW_MS = 1_700_000_000_000
MS_PER_DAY = 86_400_000


def test_coerce_block_maps_running_status():
    block = coerce_block(
        {
            "process_order_id": "PO001",
            "line_id": "MIX-04",
            "scheduled_start_ms": "1700000000000",
            "order_status": "IN PROGRESS",
            "material_id": "MAT001",
            "material_name": "Whey Protein",
        },
        NOW_MS,
    )

    assert block is not None
    assert block["id"] == "PO001-MIX-04"
    assert block["kind"] == "running"
    assert block["label"] == "Whey Protein"


def test_coerce_block_excludes_cancelled_orders():
    assert coerce_block({"order_status": "CANCELLED"}, NOW_MS) is None


def test_coerce_backlog_uses_material_name_and_due_date():
    backlog = coerce_backlog(
        {"process_order_id": "PO002", "material_id": "MAT002", "material_name": "Casein"},
        NOW_MS + MS_PER_DAY,
    )

    assert backlog["id"] == "bl-PO002"
    assert backlog["product"] == "Casein"
    assert backlog["due"] == NOW_MS + MS_PER_DAY


def test_build_kpis_counts_running_today_lines_and_backlog():
    today_ms = (NOW_MS // MS_PER_DAY) * MS_PER_DAY
    kpis = build_kpis(
        [
            {"kind": "running", "lineId": "MIX-04", "start": today_ms, "qty": 100},
            {"kind": "firm", "lineId": "SPD-01", "start": today_ms - MS_PER_DAY, "qty": 50},
        ],
        [{"id": "bl-1"}],
        NOW_MS,
    )

    assert kpis["runningCount"] == 1
    assert kpis["totalLines"] == 2
    assert kpis["todaysCount"] == 1
    assert kpis["backlogCount"] == 1
