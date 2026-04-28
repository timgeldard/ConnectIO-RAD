# shared-api

Core backend infrastructure for ConnectIO-RAD FastAPI applications.

## Features

### 🚀 Standardized App Lifecycle
- **Unified App Factory**: Initialize apps via `create_api_app` with pre-configured security, middleware, and exception handling.
- **SPA Routing**: Easy registration of frontend static assets via `register_spa_routes`.
- **Health & Readiness**: Standardized endpoints and Databricks SQL connectivity probes.

### 🛡️ Security & Middleware
- **Same-Origin Enforcement**: `SameOriginMiddleware` rejection of cross-origin mutations.
- **Token Resolution**: `require_token` dependency for consistent Databricks/OIDC token extraction.
- **In-process Rate Limiting**: `RateLimitMiddleware` with configurable per-route limits.
- **Latency Monitoring**: `LatencyMiddleware` with configurable budgets and operational alert callbacks.

### 📊 Database & Caching
- **Cached Query Decorator**: `@cached_query` for easy integration with `shared-db` tiered caching.
- **SQLAlchemy Support**: (Planned) Standard session management dependencies.

### 👁️ Observability
- **Standardized Error Responses**: Global exception mapping for both `HTTPException` and custom `DomainError` types.
- **Contextual Logging**: `RequestContextMiddleware` for injecting `request_id` and `user_email` into request state.

## Usage

```python
from shared_api import create_api_app, register_spa_routes
from shared_db.errors import send_operational_alert

app = create_api_app(
    title="My Industrial App",
    latency_budgets_ms={"/api/heavy-endpoint": 5000},
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(...)
)

# Include your routers...
# app.include_router(my_router)

# Serve the frontend
register_spa_routes(app, static_dir_getter=lambda: Path("frontend/dist"))
```
