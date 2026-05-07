# Outstanding TODOs

## Before going live

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
- [ ] **Coverage ratchet to 75%** — `apps/platform/frontend` is gated at lines/functions/branches/statements = 60/65/75/60 as of 2026-05-07; raise toward 75/75/75/75 every sprint. Other frontends and all backends are already at the 75% mandate. See `apps/platform/frontend/vite.config.ts`.

## Lower priority

- [x] **`app.yaml` files** — Review before pushing to a public remote.
- [x] **shared-auth** — Robust JWT extraction and UserIdentity model implemented.
- [x] **Full SPC suite pass** — Full suite run via current repo-standard command path.
- [ ] **`shared_db` EXTERNAL_LINKS disposition support** — the Databricks SQL Statement
  API has a 25 MB cap on inline results. Today's IMWM smoke test surfaced this for
  un-scoped `/api/wh/imwm/stock`. Mitigated for now with `LIMIT 2000` on each W360
  DAL function (matches existing convention in `fetch_bin_stock` etc.), but a real
  fix would teach `shared_db.executors._RestStatementExecutor` to (a) request
  `disposition=EXTERNAL_LINKS` for queries the caller marks as potentially-large,
  (b) follow the returned cloud-storage URLs to download chunks, (c) stream rather
  than buffer if the result is genuinely large. Affects all apps; warrants its own
  session.
