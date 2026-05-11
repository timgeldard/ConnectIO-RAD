# ADR-004: OpenAPI as the schema source of truth

- **Status:** Accepted (mechanism shipped, full rollout pending first regen)
- **Date:** 2026-05-11
- **Architecture review finding:** H-1

## Context

The platform has seven backends (Pydantic) and five frontends (TypeScript).
TypeScript types for API request/response shapes are **hand-written** in
each `apps/<x>/frontend/src/types/`.  Nothing prevents the two from drifting:

- Rename a Pydantic field → frontend silently compiles, breaks at runtime.
- Add a required field → same.
- Change a status code → the frontend's "200 means success" branch in a
  TanStack Query hook never updates.

The architecture review (H-1) called this out as high-priority schema-drift
risk.

## Decision

Treat each backend's **OpenAPI spec** as the contract.  Concretely:

1. Every backend exposes its spec via FastAPI's `app.openapi()`.
2. A repo script, `scripts/generate_openapi.py`, dumps every backend's spec
   to `apps/<app>/backend/openapi.json` and renders TypeScript types into
   `libs/shared-frontend-api/src/generated/<app>.ts` via
   [openapi-typescript](https://openapi-ts.dev).
3. The dumped JSON and generated `.ts` files **are committed** so reviewers
   see schema changes in PR diffs.
4. CI runs `python scripts/generate_openapi.py --check` on every PR; if
   regeneration would change anything, CI fails and the contributor must
   commit the regenerated output.
5. Frontend code imports from `@connectio/shared-frontend-api/generated/<app>`
   for typed API client calls; old hand-written types are migrated
   gradually.

```bash
# Local: regenerate everything
npm run openapi:generate

# CI / pre-merge: check for drift
npm run openapi:check
```

## Rollout

| Phase | Action |
|---|---|
| 1 (this ADR) | Land the script + CI gate; first regen commits all current specs. |
| 2 | Migrate one frontend module (e.g. `spc/chart-data`) to consume generated types. |
| 3 | Migrate remaining frontend modules, app by app. |
| 4 | Delete hand-written duplicate types in each app's `src/types/`. |

The generator is **non-blocking** for backends that fail to import — the
script returns nonzero and CI fails with a clear message.  This is the
intended behaviour; broken imports must be fixed before merge.

## Consequences

**Positive**

- Backend Pydantic schema is the single source of truth.
- Schema drift is caught at PR-review time, not runtime.
- New API consumers (mobile apps, BI tools, partner integrations) can
  generate clients in any language from the published spec.
- Combined with ADR-003 (API versioning), the generated types include the
  version segment so frontends pin to `/api/v1/...` shapes explicitly.

**Negative**

- Pull requests touching the backend now include a generated diff.  CI
  enforces this via `--check`.
- `openapi-typescript` is a npx-resolved dependency; the first run on a
  fresh checkout fetches it.

**Tradeoffs declined**

- **Auto-generate during build instead of committing.**  Rejected: loses
  the audit trail; PR diffs no longer reflect schema changes.
- **Use `pydantic-to-typescript` (pure-Python codegen).**  Rejected: the
  OpenAPI route also benefits non-TypeScript consumers (Python clients,
  Postman collections, etc.) and is the industry-standard path.

## Followups

- Migrate the SPC chart-data frontend module as the exemplar (matches
  ADR-003's exemplar app).
- Once an exemplar lands, add an eslint rule (`no-restricted-imports`) that
  forbids importing API types from `apps/<x>/frontend/src/types/api/` once
  a generated equivalent exists.
- Consider publishing `openapi.json` as a Databricks Apps static asset so
  external consumers can fetch it without repo access.
