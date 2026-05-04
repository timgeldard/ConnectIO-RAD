from backend.quality_record.domain.status import normalize_quality_status, batch_status_from_quality_stock

def test_normalize_quality_status():
    assert normalize_quality_status(None) == "UNKNOWN"
    assert normalize_quality_status("Released") == "ACCEPTED"
    assert normalize_quality_status("Blocked") == "REJECTED"
    assert normalize_quality_status("QI Hold") == "PENDING"
    assert normalize_quality_status("Random") == "UNKNOWN"

def test_batch_status_from_quality_stock():
    assert batch_status_from_quality_stock(0, 0, 0) == "Released"
    assert batch_status_from_quality_stock(10, 0, 0) == "Blocked"
    assert batch_status_from_quality_stock(0, 5, 0) == "QI Hold"
    assert batch_status_from_quality_stock(0, 0, 2) == "QI Hold"
    assert batch_status_from_quality_stock(0, 0, 0, rejected_results=1) == "Blocked"
    assert batch_status_from_quality_stock(0, 0, 0, failed_mics=1) == "QI Hold"
