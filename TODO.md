# Outstanding TODOs

## Before going live

- [x] **Databricks bundle validation** — all three pass `databricks bundle validate --target uat`.
  trace2 warns about missing `app.yaml` and `frontend/dist/` — both are expected (generated at deploy time).
  All three warn about `/Workspace/Shared` being world-writable — pre-existing, not caused by the migration.
  Move bundle root to a restricted path if tighter access control is needed.

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
