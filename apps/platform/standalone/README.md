# Platform Standalone Demo Apps

Standalone apps are self-contained single-page applications that live alongside the core ConnectIO modules. They are auto-discovered at platform startup: any directory under `apps/platform/frontend/standalone/<slug>/` (or the equivalent under `static/<slug>/` after build) with an `index.html` is mounted at `/<slug>`.

## Current apps

| Slug | Purpose |
|---|---|
| `blue-sky-trace` | Blue-sky trace explorer prototype |
| `enzymes` | Enzyme management concept |
| `factory-mood-board` | Factory floor mood-board visualisation |
| `maintenance` | Maintenance scheduling concept |
| `operations-suite` | Operations suite overview prototype |
| `pex-e-35` | PEx-E-35 quality process concept |
| `pi-sheet` | Pi-sheet digital twin prototype |
| `quality-suite` | Quality suite overview concept |
| `tpm` | Total Productive Maintenance concept |
| `traceability-portfolio` | Traceability portfolio overview |

## Adding a new standalone app

1. Create `apps/platform/frontend/standalone/<slug>/` with an `index.html` entry point.
2. Add a build step in `apps/platform/scripts/build.py` (or equivalent) to copy the output into `static/<slug>/`.
3. The platform shell auto-discovers it at startup — no code changes needed.

## Notes

- Standalone apps share the same Databricks App authentication context as the core modules.
- They do **not** share the `/api/*` backend namespace — standalone apps that need backend APIs must either call the platform backend routes or bundle their own.
- These are concept/prototype apps; they are not subject to the same coverage and DDD guardrail requirements as the core modules.
