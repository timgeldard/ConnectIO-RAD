"""
Domain models for batch and material identity.
"""

from dataclasses import dataclass


class BatchId(str):
    """
    Value object for Batch ID.
    Trims input and enforces length constraints.
    """
    def __new__(cls, value: str):
        if not value or not value.strip():
            raise ValueError("BatchId cannot be blank")
        stripped = value.strip()
        if len(stripped) > 80:
            raise ValueError("BatchId exceeds maximum length of 80 characters")
        return super().__new__(cls, stripped)


class MaterialId(str):
    """
    Value object for Material ID.
    Trims input and enforces length constraints.
    """
    def __new__(cls, value: str):
        if not value or not value.strip():
            raise ValueError("MaterialId cannot be blank")
        stripped = value.strip()
        if len(stripped) > 40:
            raise ValueError("MaterialId exceeds maximum length of 40 characters")
        return super().__new__(cls, stripped)


@dataclass(frozen=True)
class BatchIdentity:
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
class BatchOnlyIdentity:
    """
    Identity for a batch when material_id is not required.
    Used for summary and impact endpoints.
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
