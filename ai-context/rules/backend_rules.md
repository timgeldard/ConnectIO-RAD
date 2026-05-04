# Backend Development Rules

> Conventions for backend code in Databricks apps.
> These apply to FastAPI/Python backends using the Databricks SQL Statement API.

## 1. Architecture

We encourage a Pragmatic DDD / Modular Monolith architecture for complex apps.

```
backend/
├── main.py           ← FastAPI app, middleware, global error handler, static serving
├── core_domain/      ← Bounded Context
│   ├── application/  ← Query handlers, use cases, freshness attachment
│   ├── domain/       ← Value objects, pure business rules
│   ├── dal/          ← SQL queries and data access adapters
│   └── router.py     ← FastAPI routes for this context
├── other_domain/     ← Another Bounded Context
│   └── ...
└── utils/
    ├── db.py         ← SQL execution, token resolution, tbl(), sql_param()
    └── rate_limit.py ← Rate limiting configuration
```

## 2. Data Access Layer (DAL) Rules

### 2.1 SQL Location
- ALL SQL queries live in `dal/` files — never in routers or utils.
- Each context has its own DAL file or adapter (e.g., `core_domain/dal/core.py`).
- DAL functions are `async` and return `list[dict]` or typed results.

### 2.2 Table References
- Always use `tbl('table_name')` for fully-qualified backtick-quoted references
- `tbl()` resolves to `` `{CATALOG}`.`{SCHEMA}`.`{table_name}` ``
- NEVER hardcode catalog or schema names in SQL

### 2.3 Parameterisation
- ALL user-supplied values MUST use `sql_param(name, value)` named parameters
- The SQL Statement API uses `:name` syntax for parameter binding
- NEVER use f-strings or string concatenation for user values
- The ONLY dynamic SQL allowed is `tbl()` for table names

### 2.4 SQL Patterns
- Use `WITH RECURSIVE` for self-referencing CTEs (not plain `WITH`)
- Always include cycle detection in recursive queries
- Pre-aggregate fact tables before joining to lineage
- Use `COALESCE(SUM(...), 0)` for numeric aggregations
- Use `TRY_CAST()` instead of `CAST()` for potentially invalid data

## 3. Error Handling

### 3.1 Global Exception Handler
```python
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    error_id = str(uuid.uuid4())
    logger.exception("Unhandled error_id=%s", error_id)
    return JSONResponse(status_code=500,
        content={"detail": "Internal server error", "error_id": error_id})
```

### 3.2 SQL Error Classification
Use `classify_sql_runtime_error()` to map SQL errors to HTTP status codes:
- Permission denied → 403
- Token rejected → 401
- Table not found → 503 (with helpful message)
- Everything else → 500 with reference ID for log correlation

### 3.3 Error Response Shape
All error responses MUST have the shape: `{"detail": "message"}` or
`{"detail": "message", "error_id": "uuid"}`. Frontend depends on this.

## 4. Authentication

### 4.1 Token Resolution
- Use `resolve_token(x_forwarded_access_token, authorization)` on every endpoint
- Priority: `x-forwarded-access-token` (Databricks proxy) > `Authorization: Bearer`
- Return 401 if no token is present

### 4.2 Token Forwarding
- Pass the user's token through to SQL execution — do NOT use a service account
- This ensures Unity Catalog row-level and column-level security applies

## 5. Data Freshness

### 5.1 Freshness Metadata
- Every successful response SHOULD include a `data_freshness` block
- Freshness is computed from `system.information_schema.tables.last_altered`
- Use `attach_data_freshness(payload, token, source_views)` helper
- Freshness failures are degraded gracefully — response still returns, with
  `data_freshness: null` and a `data_freshness_warning` block

## 6. Performance

### 6.1 Concurrency
- Use `asyncio.gather()` to run independent SQL queries in parallel
- The SQL executor uses a ThreadPoolExecutor (20 workers) for non-blocking IO
- Large queries should be bounded: LIMIT, date ranges, or depth guards

### 6.2 Caching
- Results are cached in-memory with a 5-minute TTL (TTLCache)
- Cache keys include user token hash (isolation), query hash, and params hash
- Results > 1000 rows skip the cache to bound memory

## 7. Configuration

### 7.1 Environment Variables
| Variable | Purpose | Example |
|---|---|---|
| `DATABRICKS_HOST` | Workspace URL | `https://adb-123.8.azuredatabricks.net` |
| `DATABRICKS_WAREHOUSE_HTTP_PATH` | SQL warehouse path | `/sql/1.0/warehouses/abc123` |
| `TRACE_CATALOG` | Unity Catalog catalog name | `connected_plant_uat` |
| `TRACE_SCHEMA` | Schema name | `gold` |
| `APP_ENV` | Environment flag | `development` or `production` |
| `AUTH_JWKS_URL` | JWKS endpoint for production JWT verification | `https://.../.well-known/jwks.json` |
| `AUTH_JWT_AUDIENCE` | Expected JWT audience | `databricks-app` |
| `AUTH_JWT_ISSUER` | Expected JWT issuer | `https://...` |
| `AUTH_ALLOW_UNVERIFIED_JWT` | Non-production escape hatch for unsigned JWT decoding | `false` |

Production services must configure `AUTH_JWKS_URL`; unsigned JWT decoding is
only acceptable in local/test workflows or explicit emergency non-production
diagnostics.

### 7.2 App Configuration
- `app.yaml`: runtime configuration for Databricks Apps
- `app.template.yaml`: template with `{{variable}}` placeholders for bundle deploy
- NEVER commit credentials — use Databricks app environment variables or secrets

## 8. Testing

### 8.1 Offline Testing
- DAL functions should be testable with mocked `run_sql_async` responses
- Use `api_payload_examples.json` as golden output for response shape tests
- Use `entities.yaml` to validate that SQL references only approved tables

### 8.2 Integration Testing
- Hit the `/api/health` endpoint for basic liveness
- Hit `/api/ready` for full readiness (includes SQL warehouse connectivity)
- Test with known batch IDs from samples/ directory
