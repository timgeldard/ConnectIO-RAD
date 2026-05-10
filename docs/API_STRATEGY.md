# 🔌 API Documentation & Discoverability Strategy

Excellent API documentation is critical for monorepo scale. Our strategy leverages **FastAPI's** native capabilities enhanced with **Redoc** and ConnectIO-RAD specific standards.

---

## 🧭 Discoverability

### Local Exploration (Swagger UI)
Every application exposes a Swagger UI for rapid testing and exploration:
- **Default Path**: `/api/docs`
- **Feature**: Try-it-out is enabled for all non-production environments (`APP_ENV=dev`).

### Portal Documentation (Redoc)
For long-form reading and consumer onboarding, we prefer Redoc's clean layout:
- **Default Path**: `/api/redoc`
- **Target Audience**: External team integrators and business analysts.

---

## 🏷️ Standards & Metadata

To ensure a high-fidelity OpenAPI schema, all routers MUST follow these standards:

### 1. Grouping (Tags)
Every router must be tagged with its **Bounded Context** name.
```python
router = APIRouter(prefix="/api/orders", tags=["Order Execution"])
```

### 2. Descriptive Summaries
Every endpoint must have a concise summary (displayed as the title in docs).
```python
@router.get("/{id}", summary="Get order details by ID")
async def get_order(id: str): ...
```

### 3. Rich Docstrings
Use multi-line docstrings for the detailed description in Redoc.
```python
async def search_materials(q: str):
    """
    Search for manufacturing materials by SKU or name.
    
    This endpoint queries the Unity Catalog 'gold_material' view and 
    applies a fuzzy match on the provided query string.
    """
```

---

## 🎨 Schema Enhancements

### Plant-Specific Examples
Since most of our APIs are plant-scoped, we provide standard examples in our Pydantic models:
```python
class OrderRequest(BaseModel):
    plant_id: str = Field(..., example="C351", description="Kerry SAP Plant ID")
```

### Authentication Documentation
We use the `shared_auth` dependency to automatically inject security definitions into the OpenAPI spec:
- **Type**: API Key (Header)
- **Name**: `x-forwarded-access-token` (Proxy-auth) or `Authorization` (Local Bearer).

---

## 🚀 Advanced Customization

We use a custom `create_rad_app` factory in `libs/shared-api` to:
- Inject **ConnectIO Branding** into the Swagger UI.
- Filter out standard health-check routes from consumer documentation.
- Sort tags alphabetically for easier navigation.

### Implementation Checklist
- [ ] Router tagged with Bounded Context.
- [ ] Endpoints have `summary` and `response_model`.
- [ ] Docstrings provide "How it works" context.
- [ ] Pydantic models have `Field` descriptions and `examples`.
