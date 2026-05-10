# shared-api

Core backend infrastructure for ConnectIO-RAD FastAPI applications.

## Features

### 🚀 Standardized App Lifecycle
- **Unified App Factory**: Initialize apps via `create_api_app` with pre-configured security, middleware, and exception handling.
- **Framework Wrapper**: Use `ConnectIoApp` to register standard probes, debug endpoints, and SPA mounting consistently across apps.
- **SPA Routing**: Easy registration of frontend static assets via `register_spa_routes`.
- **Health & Readiness**: Standardized endpoints and Databricks SQL connectivity probes.

### 🛡️ Security & Middleware
- **Same-Origin Enforcement**: `SameOriginMiddleware` rejection of cross-origin mutations.
- **Token Dependencies**: `require_token` and `require_user` integration points for consistent Databricks/OIDC request auth.
- **In-process Rate Limiting**: `RateLimitMiddleware` with configurable per-route limits.
- **Request Context**: `RequestContextMiddleware` standardizes `request_id` and trusted forwarded user metadata.
- **Latency Monitoring**: `LatencyMiddleware` with configurable budgets and operational alert callbacks.

### 👁️ Observability
- **Standardized Error Responses**: `safe_global_exception_response` maps `HTTPException` and custom `DomainError` types to stable JSON shapes.
- **Operational Hooks**: Readiness probes and latency callbacks can surface correlation IDs and alerts without exposing internal errors to clients.

## Usage

```python
from pathlib import Path

from shared_api import ConnectIoApp
from shared_db.errors import send_operational_alert

rad_app = ConnectIoApp(
    title="My Industrial App API",
    static_dir=Path("frontend/dist"),
    latency_budgets_ms={"/api/heavy-endpoint": 5000},
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(...)
)

# Include your routers before serving the SPA.
# rad_app.include_router(my_router, prefix="/api")
# rad_app.mount_spa()

app = rad_app.fastapi_app
```
