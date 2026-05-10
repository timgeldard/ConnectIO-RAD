# Shared Library Usage Examples

## Backend App Factory

```python
from pathlib import Path

from shared_api import create_rad_app
from supplierquality_backend.supplier_quality.routers.router import router
from supplierquality_backend.utils.db import check_warehouse_config, run_sql_async

STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"

rad_app = create_rad_app(
    title="Supplier Quality API",
    app_name="supplierquality",
    static_dir=STATIC_DIR,
    check_warehouse_config=check_warehouse_config,
    run_sql=run_sql_async,
    trust_forwarded_user=True,
)
rad_app.include_router(router, prefix="/api/supplier-quality", tags=["Supplier Quality"])
rad_app.mount_spa()
app = rad_app.fastapi_app
```

## Domain Primitives

```python
from shared_domain import AuditMixin, AuditStamp, Batch, BatchId, MaterialId, Measurement, PlantId, Specification

batch = Batch(batch_id=BatchId("B-100"), material_id=MaterialId("M-200"), plant_id=PlantId("P001"))
measurement = Measurement.now(5.2, "kg")
specification = Specification(lower=None, upper=measurement.value + 1, unit="kg")
assert specification.contains(measurement)

class SupplierFinding(AuditMixin):
    def __init__(self) -> None:
        super().__init__(audit=AuditStamp.created(system="supplierquality"))

finding = SupplierFinding()
finding.record_audit(actor="qa@example.com", action="reviewed")
```

## Frontend Hooks

```tsx
import { createApiClient } from '@connectio/shared-frontend-api'
import { useEntityListQuery, useEntityMutation, useManufacturingFilters } from '@connectio/shared-frontend-api/hooks'

const api = createApiClient({ baseUrl: '/api/supplier-quality' })

export function useSupplierQualitySignals() {
  const { filters, setFilters } = useManufacturingFilters({ plantId: 'P001' })
  const signals = useEntityListQuery<SupplierSignal>('signals', {
    client: { baseUrl: '/api/supplier-quality' },
    filters,
  })
  const closeSignal = useEntityMutation<SupplierSignal, { status: string }>(
    'patch',
    '/signals/demo-signal-1/status',
    { client: { baseUrl: '/api/supplier-quality' }, invalidate: [['signals']] },
  )
  return { api, filters, setFilters, signals, closeSignal }
}
```
