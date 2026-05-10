# Rapid New Module System

## Generated Structure

```text
apps/<app-name>/
  .ai-dev-kit/
    module-contract.md
    prompts/implementation-notes.md
  .databricksignore
  Makefile
  README.md
  databricks.yml
  deploy.toml
  backend/
    project.json
    pyproject.toml
    tests/test_api.py
    <app>_backend/
      __init__.py
      main.py
      <bounded_context>/
        __init__.py
        schemas.py
        application/
          __init__.py
          queries.py
          services.py
          use_cases.py
        dal/
          __init__.py
          repository.py
        domain/
          __init__.py
          entities.py
          events.py
          models.py
          value_objects.py
        infrastructure/
          __init__.py
          dependencies.py
          settings.py
        routers/
          __init__.py
          router.py
  frontend/
    index.html
    package.json
    project.json
    tsconfig.app.json
    tsconfig.node.json
    vite.config.ts
    src/
      App.tsx
      api.ts
      index.css
      main.tsx
      queryClient.ts
      <app-name>/
        chartConfig.ts
        types.ts
        components/
          <AppName>MetricGrid.tsx
        hooks/
          use<AppName>Overview.ts
        pages/
          <AppName>Page.tsx
        __tests__/chartConfig.test.ts
      i18n/locales/
        da.json
        de.json
        en.json
        es.json
        fr.json
        ga.json
        id.json
        ja.json
        ms.json
        nl.json
        pl.json
        pt.json
        uk.json
        vi.json
        zh-Hans.json
        zh-Hant.json
  e2e/
    project.json
    playwright.config.ts
    tests/smoke.spec.ts
```

## Usage

```bash
npx nx g ./tools/generators:bounded-context --name=supplier-quality --domain=quality
```

Once npm workspace links are refreshed, the package alias is:

```bash
npx nx g @connectio/rad:bounded-context --name=supplier-quality --domain=quality
```

## Validation

```bash
python3 scripts/validate_new_app.py supplier-quality
python3 -m pytest scripts/tests/test_ddd_architecture_guardrails.py scripts/tests/test_validate_new_app.py -q
npm run test:generators
npx nx run supplierquality-backend:test
npx nx run supplierquality-frontend:typecheck
npx nx run supplierquality-frontend:test
```

Generated demo apps are intentionally platform-visible before deep cross-app wiring. Keep demo repository data in `dal/` until the Databricks gold views are ready, then replace only the repository implementation.

See `docs/architecture/shared-library-usage-examples.md` for examples of the shared backend factory, domain primitives, and frontend hooks that generated apps are expected to use.
