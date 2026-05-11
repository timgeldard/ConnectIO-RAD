# Platform Dynamic Registration

The Platform shell discovers generated bounded contexts through
`apps/platform/frontend/src/shell/module-manifest.json`. The generator appends a
registration entry when a new app is created, and the platform backend serves
that manifest at `/api/platform/apps/manifest`.

## Manifest Contract

Each module entry includes:

- `moduleId`, `displayName`, `routeBase`, `tabs`, and landing-card fields from
  the shared shell `ConnectIOModule` contract.
- `category`, `description`, and `searchKeywords` for sidebar grouping and
  global app search.
- `permissions`, a list of identity groups that may see the module. An empty
  list means visible to authenticated platform users.
- `featureFlags`, keyed as `<module-id>.enabled` by generated apps. Deployment
  overrides use environment variables such as
  `PLATFORM_FEATURE_SUPPLIERQUALITY_ENABLED=false`.
- `route`, currently `{ "kind": "local", "path": "/supplier-quality/" }` for
  bundled Databricks Apps. The contract also reserves `remote` and `external`.
- `health`, used by the home dashboard and `/api/platform/apps/status`.

## Runtime Flow

1. `App.tsx` loads `/api/platform/me` for user groups.
2. `usePlatformRegistry()` loads `/api/platform/apps/manifest`, falling back to
   the bundled JSON manifest when the backend endpoint is unavailable.
3. `getPlatformModules()` merges static mature modules with generated modules,
   applies feature flags, filters by permissions, and sorts by sidebar group.
4. `HomePanel` renders a searchable dashboard grouped by category, with health
   badges and links derived from each module route.

## Migrating Static Apps

Existing hand-authored apps may stay in `apps/platform/frontend/src/shell/modules.ts`.
Move an app into `module-manifest.json` when it can be described entirely by the
manifest contract and does not need bespoke shell composition code.

For a static app migration:

1. Copy its `ConnectIOModule` entry into `module-manifest.json`.
2. Add `category`, `description`, `permissions`, `featureFlags`,
   `searchKeywords`, `route`, and `health`.
3. Remove the old static entry only after `npx nx run platform-frontend:typecheck`
   and the platform home tests pass.
4. Keep backend routers mounted in `apps/platform/backend/main.py` until remote
   module loading replaces in-process routing.
