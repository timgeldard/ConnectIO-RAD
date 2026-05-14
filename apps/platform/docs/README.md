# Platform Shell

The Platform app is a unified Databricks App that bundles ConnectedQuality, POH, and Warehouse360 (plus their dependencies) into a single process and URL namespace. It is the primary production deployment target — each product team's standalone app is kept for isolated development and testing.

## URL layout

| Prefix | Content |
|---|---|
| `/cq/*` | ConnectedQuality SPA static assets |
| `/trace/*` | Trace2 SPA static assets |
| `/envmon/*` | EnvMon SPA static assets |
| `/spc/*` | SPC SPA static assets |
| `/poh/*` | ProcessOrderHistory SPA static assets |
| `/warehouse360/*` | Warehouse360 SPA static assets |
| `/<slug>/*` | Auto-discovered standalone demo apps |
| `/` | Home SPA (catch-all) |
| `/api/*` | All backend API routes from all bundled backends |

## Backend structure

```
apps/platform/backend/
├── main.py           # FastAPI entry point — router discovery, static mounts, health probes
├── utils.py          # PLATFORM_BACKEND_PACKAGES, ArtifactTracker, discover_app_routers
└── routes/
    ├── badges.py     # /api/badges — app badge manifest
    ├── dashboards/   # /api/dashboards — user dashboard configurations
    ├── manifest.py   # /api/manifest — app manifest
    └── session.py    # /api/session — session info
```

## How bundled backends are loaded

`discover_app_routers()` iterates `PLATFORM_BACKEND_PACKAGES` and imports each package's `ROUTER` + `API_PREFIX` at startup. Missing required packages raise immediately (fail loud). Missing optional packages are recorded in the `ArtifactTracker` and reported via `GET /api/health/routers`.

The bundled packages are installed from local wheels produced by `apps/platform/scripts/build.py`. Source lives at `apps/<x>/backend/` — never edit the gitignored build output under `apps/platform/<x>_backend/`.

## Readiness probe

`GET /api/ready` validates:
1. Databricks SQL warehouse connectivity (via POH backend)
2. Per-backend module status (`ok` / `degraded: <reason>`) for every package in `PLATFORM_BACKEND_PACKAGES`

If any *required* backend is degraded the overall status is `"degraded"`.

## Standalone demo apps

Any directory under `apps/platform/frontend/standalone/<slug>/` with an `index.html` is auto-discovered at startup and mounted at `/<slug>`. See `apps/platform/standalone/README.md` for the full list.

## Building

```bash
make build          # builds all wheels + static assets, outputs to apps/platform/static/
```

## Env vars

The platform shell does not own any env vars directly — all configuration is inherited from the bundled backend packages (`TRACE_CATALOG`, `TRACE_SCHEMA`, `CQ_CATALOG`, `POH_SCHEMA`, etc.).
