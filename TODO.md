# Outstanding TODOs

## Quality & Technical Debt

- [ ] **Lint Baseline Cleanup** — Fix pre-existing TS errors and add JSDoc to major exports to re-enable `npm run lint` in `rad check`.
- [ ] **Interrogate Ratchet** — Gradually increase `fail-under` from 40% to 80% as documentation improves.

- [x] **Databricks bundle validation** — all three pass `databricks bundle validate --target uat`.
- [x] **GitHub remote** — ConnectIO-RAD is on GitHub and `origin` is configured.
- [ ] **GitHub secrets** — add to the new repo settings: `DATABRICKS_HOST`, `DATABRICKS_TOKEN`.
- [x] **Real UAT deploy execution** — the shared deploy wrapper passes manifest validation and dry-run flows.
- [ ] **Prod resource wiring** — prod manifests now fail closed by design; wire real values intentionally.

## Consolidation next slice

- [x] **Data contract / SQL reference catalog** — promote the generated scanner output into maintained source-of-truth docs or manifests.
- [x] **Migration manifest standardization** — all apps use `deploy.toml` for first-class schema management.
- [x] **SPC shared `SqlRuntime` migration** — move SPC from tests-only coverage to actual shared runtime adoption.
- [x] **Deploy wrapper contract tests** — broaden coverage now that `scripts/deploy_app.py` is becoming shared infrastructure.
- [x] **Frontend build/dependency normalization** — continue reducing drift across the consolidated apps.
- [x] **App-level conformance expansion** — 12/12 trace endpoints verified in SPC/trace2 using shared schemas and DAL.
- [x] **Documentation Audit & Cleanup** — Stale plans deleted; root-level consolidation mapping moved to `docs/architecture/repo-consolidation.md`.

## Engineering Mandates

- [x] **100% i18n Translation Coverage** — 13 standard languages enforced via `scripts/validate_i18n.py` and pre-commit hook.
- [x] **Maintain Documentation Freshness** — Regularly audit `docs/` and `apps/*/docs/` to remove completed plans and stale quality reviews.
- [x] **Coverage ratchet to 75%** — all projects now meet or exceed the 75% mandatory statement and branch coverage floor. Gates ratcheted in pyproject.toml and vite.config.ts.

## Lower priority

- [x] **`app.yaml` files** — Review before pushing to a public remote.
- [x] **shared-auth** — Robust JWT extraction and UserIdentity model implemented.
- [x] **Full SPC suite pass** — Full suite run via current repo-standard command path.
- [x] **`shared_db` EXTERNAL_LINKS disposition support** — implemented in `libs/shared-db`:
  `_RestStatementExecutor.execute(large_result=True)` sets `disposition=EXTERNAL_LINKS`,
  follows pre-signed URLs without auth headers, and handles multi-chunk results.
  Exposed as `run_sql_large` / `run_sql_large_async` (no-cache). Streaming is not
  implemented; callers still buffer the full result set in memory.

- [ ] **M6 — `databricks.yml` workspace permissions** — every deploy emits a warning
  that `/Workspace/Shared/.bundle/platform/{uat,prod}` is writable by all workspace
  users. Scope the bundle root to a service-principal-owned folder and add explicit
  `permissions:` entries (CAN_MANAGE for the service principal, CAN_USE for the
  deploy operator group). Affects every app's `databricks.yml`, not just platform's;
  worth doing as one coordinated change. Security-adjacent, no production behaviour
  change required.

- [x] **SQL DDL catalog templating** — `apps/warehouse360/sql/views/*.sql` (views
  01–10) now use `${TRACE_CATALOG}` / `${PUBLISHED_CATALOG}` placeholders rendered
  via `scripts/render_sql_views.py` from `deploy.toml`. IMWM and near-expiry views
  (11–15) had no catalog references and are unchanged. `rendered/` output is
  gitignored. **Note**: before a prod deploy of views 05, 09, 10, confirm that
  `published_prod.central_services.*` tables exist in the production workspace.

- [ ] **Backend `--cov-branch`** — every backend's `pyproject.toml` enforces
  `--cov-fail-under=75` on line coverage but not branch coverage. Gemini review
  point. One-line addition per pyproject; will surface real gaps. (Now done in
  the small-fixes batch — keep this entry until the gates have ratcheted.)

- [ ] **`interrogate` / `pydocstyle` for docstring presence** — the "10/10 inline
  docs" mandate currently relies on review discipline. Wire `interrogate --fail-under=80`
  per backend (start at current actuals, ratchet) and `eslint-plugin-jsdoc` for
  TypeScript exports.

- [ ] **SPC Tailwind dead config** — `apps/spc/frontend/tailwind.config.ts`
  exists but `scripts/frontend-audit.mjs` (now wired into CI) finds zero
  Tailwind utility classes in the SPC source. The earlier "12 files use
  Tailwind" claim was a false positive matching `btn-sm`-style custom
  classes against the `m-` Tailwind prefix. Real action is small: delete
  the dead config + remove any Tailwind devDependency from `apps/spc/frontend/package.json`,
  not a multi-day migration. Pinned here so the cleanup can be done
  deliberately rather than in a sweep.
