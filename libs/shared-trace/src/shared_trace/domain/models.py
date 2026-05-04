"""
Core traceability domain models.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from shared_domain import AggregateRoot, ValueObject, BusinessRuleValidationException

class BatchId(str):
    """
    Value object for Batch ID.
    Trims input and enforces length constraints.
    """
    def __new__(cls, value: str):
        if not value or not value.strip():
            raise BusinessRuleValidationException("BatchId cannot be blank")
        stripped = value.strip()
        if len(stripped) > 80:
            raise BusinessRuleValidationException("BatchId exceeds maximum length of 80 characters")
        return super().__new__(cls, stripped)


class MaterialId(str):
    """
    Value object for Material ID.
    Trims input and enforces length constraints.
    """
    def __new__(cls, value: str):
        if not value or not value.strip():
            raise BusinessRuleValidationException("MaterialId cannot be blank")
        stripped = value.strip()
        if len(stripped) > 40:
            raise BusinessRuleValidationException("MaterialId exceeds maximum length of 40 characters")
        return super().__new__(cls, stripped)


@dataclass(frozen=True)
class BatchIdentity(ValueObject):
    """
    Composite identity for a material batch.
    """
    material_id: MaterialId
    batch_id: BatchId

    @classmethod
    def from_strings(cls, material_id: str, batch_id: str) -> "BatchIdentity":
        """
        Create a BatchIdentity from raw strings.
        """
        return cls(
            material_id=MaterialId(material_id),
            batch_id=BatchId(batch_id)
        )

    @property
    def material(self) -> str:
        """Return material_id as a plain string."""
        return str(self.material_id)

    @property
    def batch(self) -> str:
        """Return batch_id as a plain string."""
        return str(self.batch_id)


@dataclass(frozen=True)
class BatchOnlyIdentity(ValueObject):
    """
    Identity for a batch when material_id is not required.
    """
    batch_id: BatchId

    @classmethod
    def from_string(cls, batch_id: str) -> "BatchOnlyIdentity":
        """
        Create a BatchOnlyIdentity from a raw string.
        """
        return cls(batch_id=BatchId(batch_id))

    @property
    def batch(self) -> str:
        """Return batch_id as a plain string."""
        return str(self.batch_id)


class Material(AggregateRoot[MaterialId]):
    """
    Material Aggregate Root.
    """
    def __init__(self, identity: MaterialId, description: str, base_uom: str):
        super().__init__(identity)
        self.description = description
        self.base_uom = base_uom


class Batch(AggregateRoot[BatchIdentity]):
    """
    Batch Aggregate Root.
    """
    def __init__(
        self, 
        identity: BatchIdentity, 
        plant_id: str,
        release_status: str,
        created_date: Optional[datetime] = None,
        expiration_date: Optional[datetime] = None
    ):
        super().__init__(identity)
        if not plant_id:
            raise BusinessRuleValidationException("Batch must be associated with a plant")
            
        self.plant_id = plant_id
        self._release_status = release_status
        self.created_date = created_date
        self.expiration_date = expiration_date

    @property
    def is_expired(self) -> bool:
        if not self.expiration_date:
            return False
        now = datetime.now(self.expiration_date.tzinfo) if self.expiration_date.tzinfo else datetime.now()
        return self.expiration_date < now
        
    @property
    def release_status(self) -> str:
        return self._release_status
        
    def update_status(self, new_status: str) -> None:
        """Update the release status, protecting invariants."""
        # e.g. An expired batch shouldn't transition to Released without special override
        if self.is_expired and new_status.upper() in ["RELEASED", "ACCEPTED"]:
            raise BusinessRuleValidationException("Cannot release an expired batch without override")
        self._release_status = new_status
