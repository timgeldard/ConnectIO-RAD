"""Domain tests for Trace2 Batch and Material Identity models."""

from datetime import datetime, timedelta, timezone
import pytest
from shared_domain.exceptions import BusinessRuleValidationException
from shared_trace.domain.models import Batch, BatchId, MaterialId, BatchIdentity, BatchOnlyIdentity, Material

def test_batch_id_trims_input():
    assert BatchId("  BATCH123  ") == "BATCH123"

def test_batch_id_rejects_blank():
    with pytest.raises(BusinessRuleValidationException, match="BatchId cannot be blank"):
        BatchId("   ")

def test_batch_id_rejects_long():
    with pytest.raises(BusinessRuleValidationException, match="BatchId exceeds maximum length"):
        BatchId("A" * 81)

def test_material_id_trims_input():
    assert MaterialId("  MAT123  ") == "MAT123"

def test_material_id_rejects_blank():
    with pytest.raises(BusinessRuleValidationException, match="MaterialId cannot be blank"):
        MaterialId("   ")

def test_material_id_rejects_long():
    with pytest.raises(BusinessRuleValidationException, match="MaterialId exceeds maximum length"):
        MaterialId("A" * 41)

def test_batch_identity_properties():
    identity = BatchIdentity.from_strings("MAT1", "BAT1")
    assert identity.material == "MAT1"
    assert identity.batch == "BAT1"

def test_batch_only_identity_properties():
    identity = BatchOnlyIdentity.from_string("BAT1")
    assert identity.batch == "BAT1"

def test_batch_aggregate_expiration_rules():
    identity = BatchIdentity.from_strings("MAT1", "BAT1")
    
    # Not expired
    future_date = datetime.now(timezone.utc) + timedelta(days=30)
    batch = Batch(identity=identity, plant_id="P1", release_status="PENDING", expiration_date=future_date)
    assert not batch.is_expired
    
    # Can update to released if not expired
    batch.update_status("RELEASED")
    assert batch.release_status == "RELEASED"
    
    # Expired
    past_date = datetime.now(timezone.utc) - timedelta(days=30)
    expired_batch = Batch(identity=identity, plant_id="P1", release_status="BLOCKED", expiration_date=past_date)
    assert expired_batch.is_expired
    
    # Cannot release expired batch
    with pytest.raises(BusinessRuleValidationException, match="Cannot release an expired batch without override"):
        expired_batch.update_status("RELEASED")
        
def test_material_aggregate():
    identity = MaterialId("MAT1")
    material = Material(identity=identity, description="Test Material", base_uom="KG")
    
    assert material.identity == "MAT1"
    assert material.description == "Test Material"
    assert material.base_uom == "KG"
