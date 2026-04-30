"""Tests for equipment_insights_dal — _aggregate_by_type and _derive_equipment_insights."""
import pytest

from backend.dal.equipment_insights_dal import _aggregate_by_type, _derive_equipment_insights


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row(equipment_type, count):
    return {"equipment_type": equipment_type, "instrument_count": count}


# ---------------------------------------------------------------------------
# _derive_equipment_insights
# ---------------------------------------------------------------------------


def test_total_instrument_count_sums_all_rows():
    rows = [_row("Bioreactor", 10), _row("Tank", 5), _row("Skid", 3)]
    result = _derive_equipment_insights(rows)
    assert result["total_instrument_count"] == 18


def test_type_distribution_length_matches_input():
    rows = [_row("Bioreactor", 10), _row("Tank", 5)]
    result = _derive_equipment_insights(rows)
    assert len(result["type_distribution"]) == 2


def test_type_distribution_preserves_order():
    rows = [_row("Bioreactor", 10), _row("Tank", 5), _row("Skid", 3)]
    result = _derive_equipment_insights(rows)
    types = [e["equipment_type"] for e in result["type_distribution"]]
    assert types == ["Bioreactor", "Tank", "Skid"]


def test_pct_sums_to_100_for_clean_data():
    rows = [_row("Bioreactor", 50), _row("Tank", 50)]
    result = _derive_equipment_insights(rows)
    total_pct = sum(e["pct"] for e in result["type_distribution"])
    assert abs(total_pct - 100.0) < 0.1


def test_pct_rounds_to_one_decimal():
    rows = [_row("A", 1), _row("B", 2)]
    result = _derive_equipment_insights(rows)
    for entry in result["type_distribution"]:
        pct_str = str(entry["pct"])
        decimal_places = len(pct_str.split(".")[-1]) if "." in pct_str else 0
        assert decimal_places <= 1


def test_pct_correct_value():
    rows = [_row("Bioreactor", 80), _row("Tank", 20)]
    result = _derive_equipment_insights(rows)
    dist = {e["equipment_type"]: e["pct"] for e in result["type_distribution"]}
    assert dist["Bioreactor"] == 80.0
    assert dist["Tank"] == 20.0


def test_count_field_matches_input():
    rows = [_row("Bioreactor", 42)]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["count"] == 42


def test_empty_rows_returns_zero_total():
    result = _derive_equipment_insights([])
    assert result["total_instrument_count"] == 0
    assert result["type_distribution"] == []


def test_empty_rows_pct_is_zero_not_division_error():
    """Division by zero must not raise — pct should be 0.0 when total is 0."""
    result = _derive_equipment_insights([])
    assert result["total_instrument_count"] == 0


def test_single_row_pct_is_100():
    rows = [_row("Bioreactor", 7)]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["pct"] == 100.0


def test_null_equipment_type_coerced_to_unknown():
    rows = [{"equipment_type": None, "instrument_count": 3}]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["equipment_type"] == "Unknown"


def test_null_instrument_count_coerced_to_zero():
    rows = [{"equipment_type": "Tank", "instrument_count": None}]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["count"] == 0
    assert result["total_instrument_count"] == 0


def test_string_instrument_count_coerced():
    """Databricks may return numeric fields as strings — coercion must handle this."""
    rows = [{"equipment_type": "Bioreactor", "instrument_count": "15"}]
    result = _derive_equipment_insights(rows)
    assert result["total_instrument_count"] == 15
    assert result["type_distribution"][0]["count"] == 15


# ---------------------------------------------------------------------------
# _aggregate_by_type
# ---------------------------------------------------------------------------

def _sub_row(sub_type, count):
    return {"equipment_sub_type": sub_type, "instrument_count": count}


def test_aggregate_vessel_subtypes_merge_into_vessel():
    rows = [_sub_row("Fixed", 37), _sub_row("Mobile", 61), _sub_row("Mobile-FixBin", 81), _sub_row("ZIBC", 15)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Vessel"] == 194


def test_aggregate_scale_subtypes_merge_into_scale():
    rows = [_sub_row("Connected Scale", 45), _sub_row("Manual Scale", 36)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Scale"] == 81


def test_aggregate_auxiliary_subtypes_merge():
    rows = [
        _sub_row("Bucket", 29), _sub_row("Buckets", 2),
        _sub_row("CCP Screen", 33), _sub_row("Other", 1), _sub_row("Pump", 14),
    ]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Auxiliary Equipment"] == 79


def test_aggregate_null_subtype_becomes_uncategorised():
    rows = [_sub_row(None, 47), _sub_row(None, 32)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Uncategorised"] == 79


def test_aggregate_unknown_subtype_becomes_uncategorised():
    rows = [_sub_row("SomeNewType", 10)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Uncategorised"] == 10


def test_aggregate_sorted_descending_by_count():
    rows = [_sub_row("Fixed", 37), _sub_row("Connected Scale", 45), _sub_row("Bucket", 10)]
    result = _aggregate_by_type(rows)
    counts = [r["instrument_count"] for r in result]
    assert counts == sorted(counts, reverse=True)


def test_aggregate_empty_returns_empty():
    assert _aggregate_by_type([]) == []


def test_aggregate_full_permutations_total():
    """All known permutations sum to 433."""
    rows = [
        _sub_row("Buckets", 2), _sub_row("Bucket", 29), _sub_row("CCP Screen", 33),
        _sub_row("Other", 1), _sub_row("Pump", 14),
        _sub_row(None, 47), _sub_row(None, 32),
        _sub_row("Connected Scale", 45), _sub_row("Manual Scale", 36),
        _sub_row("Fixed", 37), _sub_row("Mobile", 61), _sub_row("Mobile-FixBin", 81), _sub_row("ZIBC", 15),
    ]
    result = _aggregate_by_type(rows)
    assert sum(r["instrument_count"] for r in result) == 433
