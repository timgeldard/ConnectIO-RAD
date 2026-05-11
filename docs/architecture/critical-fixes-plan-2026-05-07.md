# Critical Fixes — Implementation Plan

**Source review:** `docs/architecture/review-2026-05-07.md`
**Date:** 2026-05-07
**Scope:** C1 (platform duplication), C2 (databricks.yml sync), C3 (silent route failures), C4 (JWT bypass), C5 (coverage gate).

---

## Context

The review identified five CRITICAL issues. This plan covers all five. They are sequenced so each builds on the previous: C1 must land first (it eliminates the duplication every other fix has to work around), then C2 (depends on C1's new directory shape), then C3 (depends on the platform shell composition being clean), then C4 and C5 (independent of the others, can land in parallel after C1).

The plan favours **mechanical, reviewable changes** over rearchitecting. C1 and C3 are the only ones that change runtime behaviour; the rest are config/policy.

---

## Decisions

1. **C1 wheels — built fresh, gitignored.** `apps/platform/scripts/build.py` produces wheels into `apps/platform/wheels/` on every deploy. CI and local `make build` produce identical wheels via `uv build`; reproducibility comes from `uv.lock`, not from committing binaries.
2. **C4 JWKS endpoints — discovered.** UAT values:
   - `AUTH_JWKS_URL` = `https://northeurope-c2.azuredatabricks.net/oidc/jwks.json`
   - `AUTH_JWT_ISSUER` = `https://adb-604667594731808.8.azuredatabricks.net/oidc`
   - Signing alg: RS256
   For prod, run the same discovery once the prod CLI profile is re-authed:
   ```
   databricks auth env --profile prod              # get DATABRICKS_HOST
   curl <DATABRICKS_HOST>/oidc/.well-known/openid-configuration
   ```
   and read the `jwks_uri` and `issuer` fields.
3. **C5 coverage baselines — ratchet from current.** First step is to record current coverage per project and set the gate at that floor; ratchet up each sprint toward 75%. Setting 75% on day one will break PRs across apps not yet there.

---

## C1. Replace platform duplication with built wheels

### Goal

Delete the byte-for-byte copies under `apps/platform/{processorderhistory_backend,warehouse360_backend,connectedquality_backend,shared_*}/`. The platform shell becomes a thin orchestrator that imports the *real* packages, installed from wheels built at deploy time.

### Approach

1. **Create `apps/platform/scripts/build.py`** — committed, tested, replaces the missing file `deploy.toml` already references.
   - Uses `uv build` to produce a wheel for each upstream package:
     - Apps: `apps/processorderhistory/backend`, `apps/warehouse360/backend`, `apps/connectedquality/backend`, plus any others bundled into the shell.
     - Libs: `libs/shared-api`, `libs/shared-auth`, `libs/shared-db`, `libs/shared-ddd / shared-manufacturing`, `libs/shared-trace`, `libs/shared-geo`.
   - Writes all wheels to `apps/platform/wheels/`.
   - Idempotent: clears `wheels/` first, then rebuilds.
   - Exits non-zero on any build failure (so `deploy_app.py --action build` propagates the failure).

2. **Update `apps/platform/requirements.txt`** to pin each wheel by filename via a deterministic glob (`./wheels/processorderhistory_backend-*.whl`) or list explicit filenames. External deps (`fastapi`, `uvicorn`, `cachetools`, `databricks-sdk`, `databricks-sql-connector`, `PyJWT[crypto]`) stay as version pins.

3. **Add `wheels/` to `apps/platform/.gitignore`** (the wheels/ directory is build output, not source).

4. **Delete platform copies**:
   - `apps/platform/processorderhistory_backend/`
   - `apps/platform/warehouse360_backend/`
   - `apps/platform/connectedquality_backend/`
   - `apps/platform/shared_api/`, `shared_auth/`, `shared_db/`, `shared_ddd / shared_manufacturing/`
   These are now installed from wheels into the runtime venv.

5. **Verify imports still work** in `apps/platform/backend/main.py`:
   - The imports `from shared_api import ...`, `from connectedquality_backend.routers.trace import ...`, `from warehouse360_backend.order_fulfillment.router_process_orders import ...` continue to resolve — but now they resolve via installed wheels, not via filesystem co-location.
   - No code change in `main.py` is required if the upstream packages publish identical module paths (they do — the duplicate directories were exact copies).

6. **Local dev mode** — add a `make dev-install` target in `apps/platform/Makefile`:
   ```makefile
   dev-install:
       pip install -e ../processorderhistory/backend \
                   -e ../warehouse360/backend \
                   -e ../connectedquality/backend \
                   -e ../../libs/shared-api \
                   -e ../../libs/shared-auth \
                   -e ../../libs/shared-db \
                   -e ../../libs/shared-ddd / shared-manufacturing
   ```
   So a developer working on POH sees changes immediately in the platform shell without rebuilding wheels.

7. **CI integration** — `.github/workflows/ci.yml` deploy job calls `npx nx affected -t deploy` which runs `deploy_app.py`; its `--action build` step now produces wheels. No workflow change required if `deploy.toml`'s build hook is wired correctly.

### Files changed

| File | Change |
|---|---|
| `apps/platform/scripts/build.py` | **NEW** — builds all wheels |
| `apps/platform/scripts/__init__.py` | **NEW** — empty, makes scripts/ a package for testability |
| `apps/platform/scripts/test_build.py` | **NEW** — unit test that build.py produces all expected wheels |
| `apps/platform/requirements.txt` | Add wheel references |
| `apps/platform/.gitignore` | Add `wheels/` |
| `apps/platform/Makefile` | Add `dev-install` target |
| `apps/platform/processorderhistory_backend/` | **DELETED** |
| `apps/platform/warehouse360_backend/` | **DELETED** |
| `apps/platform/connectedquality_backend/` | **DELETED** |
| `apps/platform/shared_api/` | **DELETED** |
| `apps/platform/shared_auth/` | **DELETED** |
| `apps/platform/shared_db/` | **DELETED** |
| `apps/platform/shared_ddd / shared_manufacturing/` | **DELETED** |

### Verification

- Run `python apps/platform/scripts/build.py` locally — confirm wheels appear under `apps/platform/wheels/`.
- `pip install -r apps/platform/requirements.txt --find-links apps/platform/wheels/` in a clean venv — installs cleanly.
- `python -c "import backend.main"` from inside `apps/platform/` — no warnings, all routers register.
- Deploy to UAT (`python scripts/deploy_app.py --app-dir apps/platform`); confirm `/api/ready` returns 200 and at least one route from CQ, POH, and W360 returns 200.

### Risk / rollback

- Risk: wheel build picks up something subtly different from the manually-copied files (e.g., a `__init__.py` re-export was patched in the platform copy and never propagated upstream).
  - **Mitigation:** before deletion, run `diff -r apps/platform/<x>_backend apps/<x>/backend/<x>_backend` and confirm zero diff (we already did this for POH/W360/CQ — confirmed identical). Repeat for `shared_*`.
- Rollback: revert the deletion commit; the wheel-build script is additive and harmless.

---

## C2. Fix `apps/platform/databricks.yml` sync block

### Goal

The current `sync.include` references directories that no longer exist (`poh_backend/**`, `cq_backend/**`) and omits ones that do (`processorderhistory_backend/**`, `connectedquality_backend/**`, `warehouse360_backend/**`, `shared_ddd / shared_manufacturing/**`). Best practice: explicit allowlist + explicit excludes for build artefacts.

### Approach

After C1 lands, the platform directory only contains: `backend/`, `static/`, `wheels/`, `app.yaml`, `requirements.txt`, plus dev-only files (Makefile, deploy.toml, scripts/). The sync block should reflect that.

Replace the sync block with:

```yaml
sync:
  include:
    - app.yaml
    - requirements.txt
    - backend/**
    - static/**
    - wheels/**
  exclude:
    - "**/__pycache__/**"
    - "**/*.pyc"
    - "**/.pytest_cache/**"
    - "**/.mypy_cache/**"
    - "**/.ruff_cache/**"
    - "**/node_modules/**"
    - "scripts/**"
    - "deploy.toml"
    - "Makefile"
    - "app.template.yaml"
```

Notes:
- `wheels/**` is required because that's where the runtime dependencies now live (post C1).
- `scripts/**`, `deploy.toml`, `Makefile`, `app.template.yaml` are *dev-only* and don't need to ship to the workspace.
- Excludes prevent uploading 200+ MB of `__pycache__` and tooling state.

### Files changed

| File | Change |
|---|---|
| `apps/platform/databricks.yml` | Rewrite `sync` block |

### Verification

- `databricks bundle validate --target uat` from `apps/platform/` — passes.
- Run a dry deploy and confirm the file count uploaded matches expectation (no `__pycache__`, no `node_modules`, no platform-source duplication).

### Risk

Trivial — bundle config; deploy will fail-loud if anything is mis-included.

---

## C3. Make `_optional_router` loud for required artifacts

### Goal

Today, when an expected app backend fails to import (the `router_imwm` class of bug we just hit), the platform starts up cheerfully and silently 404s every route from that artifact. After this fix, missing *required* artifacts fail startup; missing *optional* artifacts surface in `/health/routers`.

### Approach

1. **Per-router artifact keys.** Today every W360 router shares the artifact key `"warehouse360_backend"` — one missing module clobbers the whole package's readiness. Change the key to the FQ module path:
   ```python
   _optional_attr("warehouse360_backend.inventory_management.router_inventory",
                  "router",
                  artifact="warehouse360_backend.inventory_management.router_inventory")
   ```
   Or, simpler: use the module path *as* the artifact key by default:
   ```python
   def _optional_router(module_name, *, required=False):
       return _optional_attr(module_name, "router", artifact=module_name, required=required)
   ```

2. **Required vs optional classification.** Add a `required: bool` parameter to `_optional_attr`:
   - If `required=True` and import fails → raise at startup (don't catch).
   - If `required=False` → current behaviour (record + warn).

   Default to `required=True` for everything currently in the platform's `CQ_ROUTERS`, `POH_ROUTERS`, `W360_ROUTERS` lists (these are the apps the platform shell *exists* to compose; their absence means a broken deploy).

3. **`/health/routers` endpoint.** Returns:
   ```json
   {
     "registered": ["cq.trace.router", "cq.envmon.router", ...],
     "missing": [],
     "expected_count": 28,
     "actual_count": 28
   }
   ```
   So ops can see drift at a glance without parsing logs.

4. **Update `/api/ready`** to return 503 only when something *required* is missing, not when an optional artifact is missing. Today `_missing_build_artifacts` is checked unconditionally and returns 503 — which conflates "broken" with "future feature not bundled yet" and discourages deploy-then-cleanup workflows.

### Files changed

| File | Change |
|---|---|
| `apps/platform/backend/utils.py` | Add `required` param; raise on failure when required |
| `apps/platform/backend/main.py` | Mark all current CQ/POH/W360 routers as `required=True`; remove the old `_optional_router(...)` shape |
| `apps/platform/backend/main.py` | Add `/health/routers` endpoint |
| `apps/platform/backend/main.py` | Refactor `/api/ready` to consider only `required` artifact failures |
| `apps/platform/backend/tests/test_routers_health.py` | **NEW** — tests `/health/routers` and the required vs optional distinction |

### Sketch of the new `_optional_attr`

```python
_REQUIRED_FAILURES: list[str] = []
_OPTIONAL_FAILURES: dict[str, str] = {}

def _import_attr(module_name: str, attr_name: str, *, required: bool):
    try:
        return getattr(import_module(module_name), attr_name)
    except Exception as exc:
        msg = f"{type(exc).__name__}: {exc}"
        if required:
            _REQUIRED_FAILURES.append(f"{module_name}.{attr_name}: {msg}")
            raise RuntimeError(
                f"Required platform artifact missing: {module_name}.{attr_name}: {msg}"
            ) from exc
        _OPTIONAL_FAILURES[module_name] = msg
        logger.warning("Optional artifact unavailable — %s.%s: %s", module_name, attr_name, msg)
        return None
```

### Verification

- Force a failure (e.g., temporarily rename a routed module) → confirm platform fails to start with a clear error message naming the module.
- `/health/routers` returns the full registered list when everything imports.
- After C1 lands, `/api/ready` returns 200 immediately (no missing artifacts).
- Deploy to UAT; confirm startup logs are clean, no warnings about missing artifacts.

### Risk

- Risk: turning silent failures into hard failures may surface latent bugs in non-platform-critical routers.
  - **Mitigation:** stage the change. First commit: introduce `required=False` everywhere, add the `/health/routers` endpoint. Second commit: flip everything in CQ/POH/W360 to `required=True` after a clean deploy proves the inventory.

---

## C4. Enable real JWT verification

### Goal

Stop running production with `AUTH_ALLOW_UNVERIFIED_JWT=true`. Wire the Databricks workspace JWKS endpoint so JWT signatures are verified by the app, not just the proxy.

### Approach

1. **Discover the JWKS URL.** For each Databricks workspace, the OIDC discovery doc is at `https://<workspace-host>/oidc/.well-known/openid-configuration`. Fetch it once per workspace and read the `jwks_uri` field (typically `https://<workspace-host>/oidc/jwks`).
2. **Add JWT config to deploy.toml** for both targets (UAT values discovered; prod values to be discovered the same way after `databricks auth login --profile prod`):
   ```toml
   [targets.uat.env]
   AUTH_JWKS_URL = "https://northeurope-c2.azuredatabricks.net/oidc/jwks.json"
   AUTH_JWT_ISSUER = "https://adb-604667594731808.8.azuredatabricks.net/oidc"
   # AUTH_JWT_AUDIENCE = "..."  # leave unset until we've inspected a real token
   AUTH_ALLOW_UNVERIFIED_JWT = "false"

   [targets.prod.env]
   AUTH_JWKS_URL = "<prod jwks_uri from OIDC discovery>"
   AUTH_JWT_ISSUER = "<prod issuer from OIDC discovery>"
   AUTH_ALLOW_UNVERIFIED_JWT = "false"
   ```
3. **Make `app.template.yaml` substitute these values** instead of hardcoding `"true"`:
   ```yaml
   - name: AUTH_JWKS_URL
     value: "${AUTH_JWKS_URL}"
   - name: AUTH_JWT_ISSUER
     value: "${AUTH_JWT_ISSUER}"
   - name: AUTH_ALLOW_UNVERIFIED_JWT
     value: "${AUTH_ALLOW_UNVERIFIED_JWT}"
   ```
   Drop the comment "Always true in this deployment context"; replace with "Verified against `AUTH_JWKS_URL` in non-dev environments."
4. **Strengthen `warn_if_jwks_unconfigured()`** in `libs/shared-auth/src/shared_auth/identity.py:59-70`:
   - When `APP_ENV` is unset or set to `production|prod|staging|uat`, raise instead of warn.
   - Keep the warning behaviour when `APP_ENV` is `development|local|test`.

### Files changed

| File | Change |
|---|---|
| `apps/platform/app.template.yaml` | Replace `value: "true"` with `value: "${AUTH_ALLOW_UNVERIFIED_JWT}"`; add `AUTH_JWKS_URL`, `AUTH_JWT_ISSUER` entries |
| `apps/platform/deploy.toml` | Add the three vars under `[targets.uat.env]` and `[targets.prod.env]` |
| `libs/shared-auth/src/shared_auth/identity.py` | `warn_if_jwks_unconfigured` becomes `enforce_jwks_configured`; raises in non-dev |
| `libs/shared-auth/tests/test_identity.py` | Add tests for: JWKS-validated token round-trip, rejection of unsigned token in non-dev, dev-mode pass-through |

### Verification

- Local: run with `APP_ENV=local AUTH_ALLOW_UNVERIFIED_JWT=true` — app starts, accepts unsigned tokens (dev workflow preserved).
- Local: run with `APP_ENV=uat` and no `AUTH_JWKS_URL` — app refuses to start.
- UAT: deploy, hit `/api/platform/me`, verify identity is extracted from a *signed* token. Tamper with the signature → 401.
- Confirm rendered `apps/platform/app.yaml` contains `AUTH_ALLOW_UNVERIFIED_JWT: "false"` and a populated `AUTH_JWKS_URL`.

### Risk

- Risk: misconfigured JWKS URL → all requests 401 → outage.
  - **Mitigation:** keep `AUTH_ALLOW_UNVERIFIED_JWT=true` in deploy.toml for one deployment cycle, deploy with the *new* validation code path, observe that JWKS is reachable from the app (add a lifespan check that fetches and caches the JWKS at startup with a clear error log on failure). On the next deploy, flip the flag to false. Roll back if real-token validation fails.
- Risk: token format from Databricks proxy doesn't match `AUTH_JWT_AUDIENCE` if set.
  - **Mitigation:** leave audience unset initially (validation is satisfied if signature, issuer, expiry are all valid). Add audience checking in a follow-up after you've inspected real tokens.

---

## C5. Enforce 75% coverage in CI

### Goal

The CLAUDE.md mandate ("75% coverage gateway") is currently policy-only — CI uploads coverage XML but never fails on coverage drop. After this fix, a PR that drops coverage below the threshold for an affected app fails CI.

### Approach

1. **Establish per-app baselines.** Run coverage today across all apps and libs, record the result. The baseline is the current coverage *floor* per project — do not jump to 75% if a project is currently at 60%, that just breaks PRs.
2. **Add the gate** in each `pyproject.toml` (or central `[tool.coverage]` config):
   ```toml
   [tool.pytest.ini_options]
   addopts = "--cov --cov-report=term --cov-report=xml --cov-fail-under=<baseline>"
   ```
   And in `vitest.config.ts` for each frontend:
   ```ts
   test: {
     coverage: {
       thresholds: { lines: <baseline>, branches: <baseline>, functions: <baseline>, statements: <baseline> }
     }
   }
   ```
3. **Ratchet schedule.** Add a `TODO.md` line: *"Coverage gates: ratchet each app +5% per sprint until 75%."*
4. **Fail-loud in CI.** No workflow change required — `nx affected -t test` already runs the test command per project; the new threshold makes the test command exit non-zero on coverage drop.
5. **Visible in PR status.** GitHub already surfaces test job failures; no extra config needed.

### Files changed

| File | Change |
|---|---|
| `pyproject.toml` (root or per-app) | `--cov-fail-under=<baseline>` |
| `apps/*/frontend/vitest.config.ts` | `test.coverage.thresholds` |
| `TODO.md` | Add ratchet schedule entry |
| `docs/architecture/repo-consolidation.md` | Document the coverage policy and current baselines table |

### Verification

- Open a PR that removes a tested function — CI fails with a clear coverage-threshold error.
- Open a PR that adds an untested function — CI fails on coverage drop for that project.
- Open a PR that is purely test additions — CI passes (coverage rises).
- Check `TODO.md` reflects the ratchet schedule.

### Risk

- Risk: setting thresholds at current actuals locks in low coverage as acceptable.
  - **Mitigation:** the ratchet schedule. The point of the gate is to prevent *regression*; the ratchet handles *improvement*.
- Risk: flaky coverage on async tests (race-y branches occasionally not covered).
  - **Mitigation:** use `--cov-context=test` and investigate any flake; almost always a real test gap.

---

## Sequencing

```
C1 (wheels build)  ──┬──>  C2 (databricks.yml)  ──>  Deploy & verify
                     │
                     └──>  C3 (loud routers)    ──>  Deploy & verify

C4 (JWT verification)  ───>  Stage with flag still true, deploy, then flip
C5 (coverage gate)     ───>  Independent; can land any time after baselines collected
```

C1 → C2 → C3 is a single sprint of work (~1 week). C4 and C5 are independent and can land in parallel by a second person.

## Cross-cutting acceptance criteria

For all five fixes to be considered "done":

- `python -c "import backend.main"` from `apps/platform/` produces zero warnings.
- `databricks bundle validate --target uat` and `--target prod` both pass.
- `/api/ready` returns 200 in UAT.
- `/health/routers` returns the full router inventory with no entries in `missing`.
- A signed-token request to `/api/platform/me` returns the identity; an unsigned-token request returns 401.
- A PR that drops coverage below the per-project baseline fails CI.
- All changes documented in `docs/architecture/` (the review file gets a follow-up "fixed in commit X" annotation per finding).

## Out of scope (intentionally)

- The HIGH and MEDIUM severity findings from the review (H1–H6, M1–M10) are *not* in this plan. They follow C1–C5 in priority but are separate work.
- No app frontend changes. Coverage gates apply to whatever tests already exist; this plan does not commission new tests beyond what's needed to verify the fixes.
- No changes to the standalone-app deploy paths (`apps/<x>/` minus platform). Those continue to work as today; C1's wheel approach only changes how the platform shell composes them.
