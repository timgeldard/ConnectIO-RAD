# Outstanding TODOs

## Before going live

- [x] **Databricks bundle validation** — all three pass `databricks bundle validate --target uat`.
  trace2 warns about missing `app.yaml` and `frontend/dist/` — both are expected (generated at deploy time).
  All three warn about `/Workspace/Shared` being world-writable — pre-existing, not caused by the migration.
  Move bundle root to a restricted path if tighter access control is needed.

- [x] **GitHub remote** — ConnectIO-RAD is on GitHub and `origin` is configured:
  ```bash
  git remote -v
  git push origin codex-magic
  ```

- [ ] **GitHub secrets** — add to the new repo settings:
  - `DATABRICKS_HOST`
  - `DATABRICKS_TOKEN`

- [ ] **Real UAT deploy execution** — the shared deploy wrapper passes manifest validation and dry-run flows for envmon, SPC, and trace2, but the live Databricks path still needs an execution window.
  - Run `python3 scripts/deploy_app.py --app-dir apps/envmon --action deploy --profile uat`
  - Run `python3 scripts/deploy_app.py --app-dir apps/spc --action deploy --profile uat`
  - Run `python3 scripts/deploy_app.py --app-dir apps/trace2 --action deploy --profile uat`
  - Capture any app-specific deploy deltas that still require post-bundle hooks or manifest fields.
  - Confirm the deployed apps can read expected UAT datasets and render their startup/readiness flows.

- [ ] **Prod resource wiring** — prod manifests now fail closed by design; wire real values intentionally before any non-UAT deploys.
  - Provide `DATABRICKS_WAREHOUSE_ID` / `DATABRICKS_WAREHOUSE_HTTP_PATH` for each app.
  - Provide real `TRACE_CATALOG` / `TRACE_SCHEMA` values per environment.
  - Provide `EM_PLANT_ID` for envmon prod.
  - Re-run `python3 scripts/deploy_app.py --app-dir <app> --action validate --profile/--target prod --dry-run` after values are supplied.

## Consolidation next slice

- [ ] **Data contract / SQL reference catalog** — promote the generated scanner output into maintained source-of-truth docs or manifests.
  - Convert `reports/consolidation/sql-table-map.md` into a maintained catalog grouped by shared tables, app-owned tables, and freshness dependencies.
  - Record which shared trace endpoints depend on which SQL objects and which are still trace2-only.
  - Document owners for each table/view family so future consolidation work has an explicit review surface.
  - Add a regeneration/check step so scanner drift is caught in CI instead of only during manual audits.

- [ ] **Migration manifest standardization** — make app migrations first-class and consistent.
  - Inventory all SQL/schema/data setup steps currently hidden in hooks, scripts, or manual runbooks.
  - Move each app onto explicit `migrations` entries in `deploy.toml` where possible.
  - Standardize migration naming, warehouse selection, ordering, and required variable handling.
  - Add focused tests for any shared migration helper behavior that becomes contract-worthy.

- [ ] **SPC shared `SqlRuntime` migration** — move SPC from tests-only coverage to actual shared runtime adoption.
  - Map SPC audit logging behavior onto `shared_db.runtime.SqlRuntime.audit_hook`.
  - Map SPC exclusion/write invalidation behavior onto the shared runtime without changing current semantics.
  - Replace the remaining SPC app-owned runtime wrapper once parity is verified.
  - Run the SPC backend test slices that exercise charts, metadata, exclusions, and trace endpoints after the migration.

- [ ] **Deploy wrapper contract tests** — broaden coverage now that `scripts/deploy_app.py` is becoming shared infrastructure.
  - Add tests for `post_deploy.workspace_files_path` validation.
  - Add tests for profile/target-scoped `allow_empty_render_variables`.
  - Add tests that prod placeholder values fail closed while valid env overrides pass.
  - Add a lightweight CI entry point for the deploy wrapper tests.

- [ ] **Frontend build/dependency normalization** — continue reducing drift across the consolidated apps.
  - Audit remaining Vite/plugin/version differences across envmon, SPC, and trace2.
  - Decide which differences are intentional versus legacy carry-over.
  - Normalize package scripts and shared frontend tooling where behavior is equivalent.
  - Re-run build/typecheck slices after each normalization step rather than bundling a large frontend migration.

- [ ] **App-level conformance expansion** — strengthen shared behavior guarantees.
  - Extend shared trace conformance to cover any future shared endpoints or response-shape guarantees.
  - Add integration coverage around shared app runtime behavior, same-origin middleware, and deploy wrapper assumptions.
  - Decide which cross-app checks should live in shared libs versus app-owned tests.

## Lower priority

- [ ] **`app.yaml` files** — `apps/trace2/app.yaml` and `apps/envmon/app.yaml` contain
  rendered environment-specific values. Review before pushing to a public remote.

- [ ] **shared-auth** — `libs/shared-auth` is a stub. Wire up real JWT/token logic
  when you're ready to centralise auth across apps.

- [ ] **Full SPC suite pass** — the focused backend slices used during consolidation are green, but the full SPC suite still needs a deliberate end-to-end run.
  - Run the backend suite via the current repo-standard command path.
  - Run any frontend/typecheck/build slices that gate SPC deploy confidence.
  - Triage failures into consolidation regressions vs. pre-existing issues.
