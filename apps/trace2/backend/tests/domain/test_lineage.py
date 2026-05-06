"""Domain tests for Trace2 lineage analysis models."""

from trace2_backend.lineage_analysis.domain.lineage import LineageDepth

def test_lineage_depth_defaults_to_4():
    assert LineageDepth() == 4

def test_lineage_depth_clamps_low():
    assert LineageDepth(0) == 1
    assert LineageDepth(-5) == 1

def test_lineage_depth_clamps_high():
    assert LineageDepth(11) == 10
    assert LineageDepth(100) == 10

def test_lineage_depth_valid_value():
    assert LineageDepth(7) == 7
