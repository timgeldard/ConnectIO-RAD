"""
Repository implementation for the Batch aggregate.
"""
from typing import Optional
from shared_domain.repository import Repository
from shared_trace.domain.models import Batch, BatchIdentity
from .trace_core import get_trace_core_dal
from datetime import datetime

class BatchRepository(Repository[Batch, BatchIdentity]):
    """
    Repository for managing Batch aggregates.
    Currently readonly using the Databricks SQL Warehouse.
    """
    
    def __init__(self, token: str):
        self._dal = get_trace_core_dal()
        self._token = token
        
    async def get(self, identity: BatchIdentity) -> Optional[Batch]:
        """Fetch a Batch aggregate by its identity."""
        row = await self._dal.fetch_batch_header(self._token, identity.material, identity.batch)
        if not row:
            return None
            
        # Parse dates if they exist in the raw response
        created_date = None
        if row.get("manufacture_date"):
            # Simple ISO parsing; depends on how the DB formats it
            try:
                created_date = datetime.fromisoformat(row["manufacture_date"])
            except ValueError:
                pass
                
        expiration_date = None
        if row.get("expiry_date"):
            try:
                expiration_date = datetime.fromisoformat(row["expiry_date"])
            except ValueError:
                pass
                
        batch = Batch(
            identity=identity,
            plant_id=row.get("plant_id", "UNKNOWN"),
            release_status=row.get("batch_status", "UNKNOWN"),
            created_date=created_date,
            expiration_date=expiration_date
        )
        return batch

    async def save(self, aggregate: Batch) -> None:
        """
        Persist a Batch aggregate.
        Not implemented for trace2 as it is a read-only CQRS context.
        """
        raise NotImplementedError("Batch trace context is read-only")
