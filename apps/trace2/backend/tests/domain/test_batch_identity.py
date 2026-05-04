import pytest
from backend.batch_trace.domain.identity import BatchId, MaterialId, BatchIdentity, BatchOnlyIdentity

def test_batch_id_trims_input():
    assert BatchId("  BATCH123  ") == "BATCH123"

def test_batch_id_rejects_blank():
    with pytest.raises(ValueError, match="BatchId cannot be blank"):
        BatchId("   ")

def test_batch_id_rejects_long():
    with pytest.raises(ValueError, match="BatchId exceeds maximum length"):
        BatchId("A" * 81)

def test_material_id_trims_input():
    assert MaterialId("  MAT123  ") == "MAT123"

def test_material_id_rejects_blank():
    with pytest.raises(ValueError, match="MaterialId cannot be blank"):
        MaterialId("   ")

def test_material_id_rejects_long():
    with pytest.raises(ValueError, match="MaterialId exceeds maximum length"):
        MaterialId("A" * 41)

def test_batch_identity_properties():
    identity = BatchIdentity.from_strings("MAT1", "BAT1")
    assert identity.material == "MAT1"
    assert identity.batch == "BAT1"

def test_batch_only_identity_properties():
    identity = BatchOnlyIdentity.from_string("BAT1")
    assert identity.batch == "BAT1"
