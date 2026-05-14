# ConnectIO Platform Shell

The unified entry point and navigation shell for all applications in the ConnectIO-RAD suite.

## Features

- **Multi-App Navigation**: Unified sidebar to switch between SPC, Trace, EnvMon, and others.
- **Cross-App Context**: Syncs active plant, material, and process order context across apps.
- **Badge Aggregation**: Centralised alerting and attention signals from all integrated backends.
- **Genie Assistant**: Global contextual assistant powered by domain-aligned Genie spaces.

## Deploy Safety

Deploy the platform through the shared wrapper, not raw `databricks bundle deploy`
or `databricks apps deploy`. The platform syncs generated `static/` and
`wheels/` directories, so the build step must run immediately before the bundle
snapshot is uploaded.

```bash
python3 scripts/deploy_app.py --app-dir apps/platform --profile uat --target uat
```

For production:

```bash
python3 scripts/deploy_app.py --app-dir apps/platform --profile prod --target prod
```

After deploy, check `/api/health/routers`. It must include
`active_modules`, `registered_methods`, and `POST` entries for
`/api/poh/orders` and `/api/poh/pours/analytics`. If those fields are missing,
the app is running an old platform backend snapshot.
