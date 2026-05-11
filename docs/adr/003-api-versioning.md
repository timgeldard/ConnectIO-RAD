# ADR-003: API versioning via `/api/v{N}/...`

- **Status:** Accepted (mechanism shipped, app migration in progress)
- **Date:** 2026-05-11
- **Architecture review finding:** C-3

## Context

The platform exposes ~80 REST endpoints across seven backends.  Until now,
all endpoints lived under `/api/...` with no version segment.  Any breaking
change to a response shape or required-parameter list would force a flag
day with every frontend SPA and any external integration.

We surveyed the existing endpoints during the architecture review and
confirmed there is no breaking-change deprecation policy.  Without a
versioned namespace the platform cannot evolve safely once external
consumers exist (mobile apps, partner integrations, BI tools).

## Decision

Adopt a **two-track URL shape** in `ConnectIoApp`:

- **Canonical:** `/api/v{N}/<app>/<resource>` — e.g. `/api/v1/spc/chart-data`.
- **Deprecated alias:** `/api/<app>/<resource>` — same handler, kept for
  one deprecation cycle while frontends migrate.

A new method on `ConnectIoApp`, `include_versioned_router(router, prefix=...,
version="v1", deprecated_alias=True)`, registers both routes simultaneously.

```python
# Before
rad.include_router(spc_charts_router, prefix="/api/spc")

# After
rad.include_versioned_router(spc_charts_router, prefix="/api/spc")
# now answers on BOTH /api/v1/spc/... and /api/spc/...
```

Health, readiness, identity (`/me`), and SPA-mount routes remain
**unversioned** — these are infrastructure endpoints, not part of the
business-API contract.

## Versioning policy

1. **Breaking changes go to a new major version.**  A breaking change
   includes: removing a field, renaming a field, changing a type, adding a
   required parameter, changing an HTTP status code's meaning.
2. **Additive changes stay in the current version.**  Adding an optional
   field, adding an enum value at the tail, adding a new endpoint.
3. **Versions are positive integers prefixed with `v`** (`v1`, `v2`).  No
   minor versions in the URL — that's what semver on the response shape
   inside the body is for.
4. **Each major version is supported for at least one release cycle (~6 months)**
   after the next version ships.  The alias mechanism keeps the old URL
   alive during that window.

## Migration order

1. Land the mechanism (this ADR, shipped).
2. **One exemplar app** — convert SPC's process-control routers to
   `include_versioned_router`.  Both shapes resolve; SPC frontend continues
   to work unchanged.
3. **Roll across remaining apps**, one PR per app.  Tests assert both
   shapes for each migrated endpoint.
4. **Frontend migration window** — update SPA fetch calls to `/api/v1/...`.
5. **Cut the legacy alias** — flip `deprecated_alias=False` per route after
   the frontend window closes.

The exemplar in step 2 is the bar — until SPC ships with both shapes
working end-to-end (including the frontend SPC fetch), no other app needs
to migrate.

## Consequences

**Positive**

- Breaking changes no longer require a flag day.
- External integrations can target `/api/v1/...` knowing it is the stable
  contract.
- OpenAPI now describes both shapes; consumers see clearly which is
  canonical.

**Negative**

- Two paths per endpoint until the alias is cut — slightly larger OpenAPI
  output, slightly more routing work per request.
- A migration discipline is now required (CI cannot fully enforce this; it
  is a code-review item).

**Followups**

- Add a CI lint that requires every new router file to call
  `include_versioned_router`, not `include_router`, when the prefix starts
  with `/api/<app>`.  Initial implementation is judgement-only at code
  review.
- When migrating an app, update its OpenAPI codegen output path
  (see ADR-004, H-1) to point at the versioned base URL.

## Alternatives considered

- **Header-based versioning (`Accept: application/vnd.connectio.v1+json`).**
  Rejected: harder to test in a browser, breaks naive curl examples, no
  user-visible signal in URL.
- **Subdomain-based versioning (`v1.api.example.com`).**  Rejected: requires
  workspace-level routing changes in Databricks Apps and complicates the
  proxy auth flow.
- **Per-endpoint version in path (`/api/spc/v1/chart-data`).**  Rejected:
  multiplies the migration surface; we want one version axis per app.
