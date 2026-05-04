"""Domain tests for supplier and exposure risk rules."""

from backend.lineage_analysis.domain.risk import normalize_risk, supplier_risk_score

def test_normalize_risk():
    assert normalize_risk(None) == "LOW"
    assert normalize_risk("low") == "LOW"
    assert normalize_risk("Medium") == "MEDIUM"
    assert normalize_risk("HIGH") == "HIGH"
    assert normalize_risk("CRITICAL") == "CRITICAL"
    assert normalize_risk("Very High") == "CRITICAL"

def test_supplier_risk_score():
    assert supplier_risk_score(0, 10) == "LOW"
    assert supplier_risk_score(1, 10) == "MEDIUM"  # 10% failure
    assert supplier_risk_score(3, 10) == "HIGH"    # 30% failure
    assert supplier_risk_score(6, 10) == "CRITICAL" # 60% failure
    assert supplier_risk_score(11, 100) == "CRITICAL" # > 10 rejected
    assert supplier_risk_score(0, 0) == "LOW"
