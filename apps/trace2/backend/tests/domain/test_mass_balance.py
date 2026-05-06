"""Domain tests for mass balance variance and calculation rules."""

from trace2_backend.quality_record.domain.mass_balance import calculate_mass_balance_variance, movement_delta

def test_calculate_mass_balance_variance():
    assert calculate_mass_balance_variance(100, 80, 25) == 5  # 25 - (100 - 80) = 5
    assert calculate_mass_balance_variance(100, 80, 20) == 0

def test_movement_delta():
    assert movement_delta("Production", 50) == 50
    assert movement_delta("Production", -50) == 50
    assert movement_delta("Shipment", 30) == -30
    assert movement_delta("Shipment", -30) == -30
    assert movement_delta("Other", 10) == 10
