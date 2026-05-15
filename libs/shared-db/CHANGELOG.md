# shared-db Changelog

All notable changes to `shared-db` are documented here.
Version numbers follow [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-05-15

### Summary

All six per-app Databricks SQL wrappers are now clean of direct `databricks`
imports and the private `_sql_executor` symbol. Concurrency limits are
centralised in the shared registry. Three enforcement tests guard the boundary
in CI. Two new public symbols complete the migration.

### Added

- `is_connector_available() -> bool` — public predicate replacing per-app
  `try: from databricks import sql / except ImportError` guards. Importable
  from the top-level `shared_db` package.
- `get_semaphore(key: str) -> asyncio.Semaphore` — factory that lazily creates
  named semaphores reading `SQL_CONCURRENCY_LIMIT_<KEY>` (falling back to
  `SQL_CONCURRENCY_LIMIT`, default 4). Replaces six module-level
  `asyncio.Semaphore(int(os.environ.get("SQL_CONCURRENCY_LIMIT", "4")))` blocks
  across apps. Key names in production: `spc`, `envmon`, `trace2`, `warehouse360`,
  `cq`, `poh`.
- `scripts/tests/test_dal_uses_shared_db.py` — AST governance test asserting
  every `dal/*.py` file in any app backend imports neither `databricks` directly
  nor private `shared_db._*` names.

### Changed

- All six app `utils/db.py` / `db.py` wrappers now use `run_in_sql_executor`
  in place of `loop.run_in_executor(_sql_executor, ...)`.
- `CLAUDE.md` Key Conventions updated to mandate `shared_db` as the only
  Databricks SQL path.
- `ai-context/rules/backend_rules.md` section 2.0 added with the shared-db
  mandate and links to reference docs.
- `docs/adr/007-shared-db-as-canonical-data-access.md` added.

### Anti-API additions

| Symbol | Reason |
|---|---|
| `shared_db.executors._CONNECTOR_EXECUTOR` | Prefer `is_connector_available()` + `run_in_sql_executor` |
| `shared_db.executors._REST_EXECUTOR` | Prefer `run_in_sql_executor` |

Note: SPC and envmon still import `_CONNECTOR_EXECUTOR` / `_REST_EXECUTOR` for
their `_get_sql_executor()` fallback functions. These are the last remaining
callers of private executor symbols and are candidates for a future
`shared_db.get_executor()` helper.

---

## [1.0.0] — 2026-05-14

### Summary

Public API surface is now **frozen and documented**. This release locks the symbols
that app code may depend on. Anything not listed in `__all__` is private and may
change without notice.

### Added

- `run_in_sql_executor(fn)` — public async helper to run a blocking callable on the
  shared SQL thread pool. Replaces direct use of the private `_sql_executor`. See
  [docs/shared-db.md](../../../docs/shared-db.md) for usage.
- `SqlRuntimeConfig` is now exported from the top-level `shared_db` package.
- `__all__` declarations in every submodule (`core`, `runtime`, `errors`, `freshness`,
  `utils`, `authorized_scope`, `query_builder`, `executors`) — signals public intent
  per PEP 8.
- Module-level docstrings added to all submodules without them.
- `docs/shared-db.md` — full API reference.
- `docs/shared-db-quickstart.md` — one-page FastAPI integration tutorial.
- `docs/shared-db-migration-matrix.md` — per-app symbol audit for migration planning.

### Changed

- `__init__.py` package docstring updated to state the single-path-to-Databricks mandate.
- `__init__.py.__all__` restructured with §3 section comments for readability.

### Deprecated

Nothing deprecated in this release.

### Anti-API (not exported)

The following are private and MUST NOT be imported by app code:

| Symbol | Reason |
|---|---|
| `shared_db.executors._sql_executor` | Use `run_in_sql_executor` instead |
| `shared_db.executors._REST_EXECUTOR` | Internal; executor selection is abstracted |
| `shared_db.executors._CONNECTOR_EXECUTOR` | Internal; executor selection is abstracted |
| `shared_db.core.TTLCache` | Implementation detail |
| `shared_db.runtime._strip_leading_comments` | Internal |
| `shared_db.runtime.statement_has_limit` | Internal |
| Any `databricks.*` symbol | Import databricks only via shared_db |

---

## [0.1.2] — 2026-05-07

- `apply_max_rows_guard` helper for safe LIMIT injection on read statements.
- `run_sql_in` parameter builder for IN-clause queries.
- `check_wheel_versions.py` added `libs/shared-db` to PACKAGES list.

## [0.1.1] — 2026-04-20

- `DataFreshnessRuntime` and `SqlRuntime` / `CachePolicy` promoted from SPC-internal
  to shared library.
- `fetch_authorized_plants` / `assert_plant_authorized` moved from per-app code.

## [0.1.0] — 2026-03-15

- Initial extraction from `apps/spc/backend/spc_backend/utils/db.py`.
- `run_sql`, `run_sql_async`, `tbl`, `sql_param`, `resolve_token`,
  `check_warehouse_config`, `classify_sql_runtime_error`.
