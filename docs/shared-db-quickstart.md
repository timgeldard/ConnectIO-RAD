# shared-db Quickstart

One-page guide for wiring a new FastAPI router to Databricks SQL via `shared-db`.

---

## 1. Add a DAL module

```python
# apps/myapp/backend/myapp_backend/my_context/dal/items.py

from shared_db import (
    tbl,
    sql_param,
    run_sql,
    SqlRuntime,
    CachePolicy,
    DataFreshnessRuntime,
    TRACE_CATALOG,
    TRACE_SCHEMA,
)

_runtime = SqlRuntime(
    run_sql=lambda token, stmt, params=None: run_sql(token, stmt, params),
    cache_policy=CachePolicy.manufacturing(),
)

_freshness = DataFreshnessRuntime(
    run_sql=lambda token, stmt, params=None: run_sql(token, stmt, params),
    catalog=lambda: TRACE_CATALOG,
    schema=lambda: TRACE_SCHEMA,
)


async def list_items(token: str, plant_id: str) -> list[dict]:
    """Return items for the given plant from the gold layer."""
    return await _runtime.run_sql_async(
        token,
        f"SELECT item_id, description FROM {tbl('gold_items')} WHERE plant_id = :plant_id",
        [sql_param("plant_id", plant_id)],
        endpoint_hint="items.list",
    )


def get_freshness(token: str) -> dict:
    """Return data-freshness metadata for the items view."""
    return _freshness.get_data_freshness(token, ["gold_items"])
```

---

## 2. Wire the FastAPI router

```python
# apps/myapp/backend/myapp_backend/my_context/router.py

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException

from shared_db import resolve_token, check_warehouse_config, assert_plant_authorized
from shared_db.utils import handle_sql_error

from .dal.items import list_items, get_freshness

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/")
async def get_items(
    plant_id: str,
    x_forwarded_access_token: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """List items for a plant."""
    check_warehouse_config()
    token = resolve_token(x_forwarded_access_token, authorization)
    await assert_plant_authorized(token, plant_id)

    try:
        rows = await list_items(token, plant_id)
    except Exception as exc:
        handle_sql_error(exc)   # maps SQL errors → HTTP 500 with error_id

    payload = {"plant_id": plant_id, "items": rows}
    payload["data_freshness"] = get_freshness(token)
    return payload
```

---

## 3. Register the router

```python
# apps/myapp/backend/myapp_backend/main.py

from shared_api import create_api_app
from shared_db import check_warehouse_config

from myapp_backend.my_context.router import router

app = create_api_app(title="MyApp")
app.include_router(router)

@app.on_event("startup")
async def startup():
    check_warehouse_config()
```

---

## Checklist before merging

- [ ] All SQL goes through `run_sql_async` or `SqlRuntime.run_sql_async` — no direct `databricks` imports.
- [ ] Every value in SQL uses `:param` binding via `sql_param` — no f-string value injection.
- [ ] Table references use `tbl("view_name")` — no hardcoded catalog/schema.
- [ ] `endpoint_hint` is set on every `run_sql_async` call (aids slow-query detection).
- [ ] `check_warehouse_config()` is called at startup.
- [ ] `resolve_token` is used to extract the token from request headers.

---

## Common patterns

### IN clause

```python
from shared_db import run_sql_in, run_sql_async, tbl

plant_ids = ["PL01", "PL02", "PL03"]
placeholders, params = run_sql_in(plant_ids, prefix="p")
rows = await run_sql_async(
    token,
    f"SELECT * FROM {tbl('gold_plant')} WHERE plant_id IN ({placeholders})",
    params,
    endpoint_hint="plants.filter",
)
```

### Large result sets (> 25 MB)

```python
from shared_db import run_sql_large_async, tbl

rows = await run_sql_large_async(
    token,
    f"SELECT * FROM {tbl('gold_batch_lineage')}",
    endpoint_hint="lineage.full_export",
)
```

### Running a blocking call on the SQL thread pool

```python
from shared_db import run_in_sql_executor

result = await run_in_sql_executor(lambda: some_blocking_operation())
```

### Async freshness attachment with graceful downgrade

```python
from shared_db.utils import attach_payload_freshness

payload = await attach_payload_freshness(
    payload,
    token,
    request_path="/items/",
    source_views=["gold_items"],
    attach_freshness_func=attach_data_freshness,
)
# If freshness lookup fails with 503, payload["data_freshness"] is null
# instead of raising an exception.
```

---

For the full API reference see [docs/shared-db.md](shared-db.md).
