import pytest
from spc_backend.process_control.domain.capability import compute_non_parametric_capability

def test_non_parametric_capability():
    # Simple uniform distribution from 0 to 200 (n=201 >= 125)
    values = list(range(201)) 
    # p00135 = 0.00135 * 200 = 0.27
    # p50 = 100.0
    # p99865 = 0.99865 * 200 = 199.73
    
    # usl = 220, lsl = -20
    # ppk_u = (220 - 100) / (199.73 - 100) = 120 / 99.73 = 1.203248...
    # ppk_l = (100 - (-20)) / (100 - 0.27) = 120 / 99.73 = 1.203248...
    
    res = compute_non_parametric_capability(values, usl=220.0, lsl=-20.0)
    assert res["ppk_non_parametric"] == pytest.approx(1.203248, rel=1e-3)

def test_non_parametric_with_empty_data():
    assert compute_non_parametric_capability([], usl=10, lsl=0) == {}


def test_non_parametric_with_low_sample_size():
    # n=100 < 125
    values = list(range(100))
    res = compute_non_parametric_capability(values, usl=110, lsl=-10)
    assert res["ppk_non_parametric"] is None
    assert "warning" in res
    assert "requires n >= 125" in res["warning"]
