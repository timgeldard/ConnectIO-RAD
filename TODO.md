# Outstanding TODOs

## Before going live

- [ ] **Databricks bundle validation** — run from each app directory to confirm paths resolve after the monorepo move:
  ```bash
  cd apps/trace2 && databricks bundle validate --target uat
  cd apps/spc    && databricks bundle validate --target uat
  cd apps/envmon && databricks bundle validate --target uat
  ```

- [ ] **GitHub remote** — create ConnectIO-RAD repo on GitHub, then:
  ```bash
  git remote add origin <url>
  git push -u origin main
  ```

- [ ] **GitHub secrets** — add to the new repo settings:
  - `DATABRICKS_HOST`
  - `DATABRICKS_TOKEN`

## Lower priority

- [ ] **`app.yaml` files** — `apps/trace2/app.yaml` and `apps/envmon/app.yaml` contain
  rendered environment-specific values. Review before pushing to a public remote.

- [ ] **shared-auth** — `libs/shared-auth` is a stub. Wire up real JWT/token logic
  when you're ready to centralise auth across apps.

- [ ] **SPC tests** — `apps/spc` has a test suite (absorbed from the original repo).
  Run `nx run spc-backend:test` to confirm it passes against the new shared_db proxy imports.
