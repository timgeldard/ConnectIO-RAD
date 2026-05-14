# ConnectIO-RAD — Critical Technical & Functional Review

**Reviewer role:** Senior technical architect
**Branch reviewed:** `main` @ `6106010` (in sync, working tree clean)
**Scope:** Whole monorepo — 7 Databricks Apps, 14 shared libraries, CI, ai-context, docs, packaging.
**Method:** Multi-pass audit across backend, frontend, shared libs, tests/CI, security, docs, and platform packaging. Findings carry `path:line` references where possible.

This is a **critical** review. The healthy areas (and there are many — see Appendix B) are intentionally compressed; the body of the document is the issue register and the sliced plan to address each one.

---

## 1. Executive verdict

ConnectIO-RAD is a **well-instrumented modular monolith** with above-average guardrails for a manufacturing analytics platform: parameterised SQL throughout, importlinter-enforced DDD, semantic-model governance tests, gold-view contract smoke, OpenAPI drift gate, gitleaks + pip-audit + CodeQL, 13-locale i18n with a validation hook, and Playwright in CI with a per-app live-UAT matrix.

The risks are **almost entirely on the second tier**: shape drift between apps that was not corrected as the monorepo grew. The platform has 8 backends, 7 frontends, and 14 shared libs, and the cost of each small inconsistency compounds. Specifically:

- **Coverage and docstring ratchets are honest but the floor is too low** for SPC backend (40% interrogate), shared-db (32%), shared-auth (43%) and ConnectedQuality unit tests (3 tests, 0 E2E).
- **Frontend hygiene has drifted**: React version mismatch in `template`, TanStack Query minor drift, `noImplicitAny: false` in W360, zero `React.lazy()` code-splitting, missing root-level error boundaries in 4 of 7 apps, `(window as any)` globals in POH.
- **Security hardening is 80% done**: auth, redaction, rate limit, parameterised SQL are solid; CSP/HSTS headers and Databricks bundle workspace permissions (TODO M6) are the remaining gaps.
- **shared-trace is under-leveraged**: ConnectedQuality re-implements trace routing instead of delegating to the library; `shared-geo` may be orphaned; `shared-reporting` and `shared-ui` lack Storybook/RTL coverage despite having a Storybook plugin wired in `nx.json`.
- **DDD guardrails are airtight at the linter layer**, but a handful of bare `except Exception:` swallows in read paths (envmon queries, POH dashboards router, trace2 utils/db) mask partial failures.
- **Documentation is comprehensive but uneven**: 5 of 8 apps have `docs/`, ADRs lack status markers, and the agent-context files have minor contradictions worth resolving (e.g., README claims React 19, repo runs React 18).

None of the findings rise to "stop the line." Several rise to **"fix before the next prod cut"**. Most are correct candidates for a 4–6 sprint slicing.

---

## 2. Findings register

Each finding has: ID, severity (P0–P3), area, file:line evidence, diagnosis. P0 = ship-blocker risk, P1 = fix this sprint, P2 = next slice, P3 = backlog hygiene.

### 2.1 Security

| ID | Sev | Title | Evidence | Diagnosis |
|---|---|---|---|---|
| SEC-01 | P1 | Databricks bundle root `/Shared/.bundle/...` writable to all workspace users | `apps/platform/databricks.yml:38-41`; TODO M6 | All 7 apps' bundles deploy under `/Workspace/Shared/.bundle/<app>/<target>` with default ACLs; any workspace user can overwrite a deploy artefact. |
| SEC-02 | P1 | Missing `Content-Security-Policy` and `Strict-Transport-Security` headers | `libs/shared-api/src/shared_api/middleware.py:164-175` | `SecurityHeadersMiddleware` sets `nosniff`, `frame-options DENY`, `referrer-policy`, but no CSP or HSTS — relevant because frontends serve over the public Databricks Apps proxy. |
| SEC-03 | P2 | `(window as any).__navigateToPourAnalytics` / `__navigateToOrder` global | `apps/processorderhistory/frontend/src/App.tsx:104-140` | Cross-app navigation via window globals bypasses the type system and creates an untyped extension surface that scripts on the page (or future microfrontends) can attach to. |
| SEC-04 | P2 | EnvMon persists `em_view`, `em_persona`, `em_portfolio_days` in `localStorage` | `apps/envmon/frontend/src/context/EMContext.tsx` | No TTL, no invalidation on auth change; persona-bound state survives logout/role change. |
| SEC-05 | P2 | OpenAPI docs (`/api/docs`) reachable in non-prod by default | `libs/shared-api/src/shared_api/app_factory.py` (docs config) | Acceptable in UAT, but verify `enable_docs=False` (or env-gated) in production deploys. |
| SEC-06 | P3 | Audit gate `gitleaks-action` pinned to `@v2.3.9` while CodeQL pinned only to `@v3` | `.github/workflows/ci.yml` | Floating major tag on CodeQL is a softer guarantee than the gitleaks pin — align to fully-pinned actions. |
| SEC-07 | P3 | Wheel-bundled backends not signed/hashed | `apps/platform/scripts/build.py` | Wheels are built at deploy time on the runner; no integrity attestation. Low risk because deploy is single-tenant CI, but worth a sigstore step for prod. |

**Healthy:** parameterised `:param` SQL throughout; safe `string.Template` substitution in `scripts/render_sql_views.py`; JWT signature with RS256/ES256, `aud`/`iss` pinned outside dev mode; PII redaction (`libs/shared-api/src/shared_api/observability.py:14-22`); rate limiter on by default (`libs/shared-api/src/shared_api/rate_limit.py:62-116`); no committed secrets; pip-audit + npm audit + CodeQL all in CI.

### 2.2 Backend / DAL / DDD

| ID | Sev | Title | Evidence | Diagnosis |
|---|---|---|---|---|
| BE-01 | P1 | Bare `except Exception:` swallows in read paths | `envmon_backend/inspection_analysis/application/queries.py:~110-112`; `apps/platform/backend/routes/dashboards/router.py`; `apps/trace2/backend/.../utils/db.py` (freshness path) | Silent fallbacks (e.g. `return 0`) mask partial DB failure; users see a "zero" instead of an error and dashboards lie. |
| BE-02 | P2 | Per-app `utils/db.py` wrappers diverge (semaphore, cache, audit hook) | `spc/.../utils/db.py:197,331`; `envmon/.../utils/db.py`; `connectedquality/.../db.py`; `trace2/.../utils/db.py` | Same wrapping pattern reinvented 4×; SPC's tiered cache + query audit and CQ's semaphore are the right primitives to promote into `shared-db`. |
| BE-03 | P2 | `template_backend` still uses legacy `create_rad_app()` rather than `ConnectIoApp` | `apps/template/backend/.../main.py` | Template is the canonical new-module starting point and currently teaches the older shape. |
| BE-04 | P2 | Platform shell defines its own `/api/health` / `/api/ready` instead of using `ConnectIoApp` helpers | `apps/platform/backend/main.py:83-96` | Bypasses the standard readiness-aggregation pattern; readiness for bundled backends is not exercised through the shared probe. |
| BE-05 | P3 | `IN` clause built from f-string in EnvMon plant DAL | `apps/envmon/backend/envmon_backend/spatial_config/dal/plants.py:~45` | Listed as f-string with `{in_clause}`; needs an explicit array-binding helper or a documented allow-list assertion so future edits don't accidentally introduce injection. |
| BE-06 | P3 | `connectedquality` re-implements trace routes instead of using `shared-trace` | `apps/connectedquality/backend/.../routers/trace.py` vs `libs/shared-trace/src/.../dal.py` | Duplicated `trace_recall` / `trace_lineage` / `trace_mass_balance` logic; `shared-trace.TraceCoreDal` exists but is under-used. |
| BE-07 | P3 | TODO/FIXME tail (9 markers) — POH `pours_analytics_dal` (shift attribution), template router demo metrics | (greppable) | Low risk, but the POH shift attribution gap should be tracked as a domain issue, not a code TODO. |

**Healthy:** importlinter contracts in `.importlinter` (domain purity, context independence, application no-fastapi, shared-kernel purity, CQ aggregator whitelist) all currently pass; no direct `databricks-sql-connector` calls in app code; `tbl()` uniformly used; auth uniformly via `require_proxy_user` dependency.

### 2.3 Frontend

| ID | Sev | Title | Evidence | Diagnosis |
|---|---|---|---|---|
| FE-01 | P1 | React version drift: template pins React 19, all other apps + `shared-ui` peer-dep are 18.3.1 | `apps/template/frontend/package.json:5`; `libs/shared-ui/package.json` | New-app generator is broken or sets up the wrong peer; README also still claims React 19. |
| FE-02 | P1 | `noImplicitAny: false` in W360 + 204 explicit `: any` usages across frontends | `apps/warehouse360/frontend/tsconfig.app.json:20-21,31` | Breaks the 10/10 self-documenting mandate; type system is muted in W360. |
| FE-03 | P1 | Coverage thresholds defined only on 3 of 7 frontends (template, CQ, platform) | `apps/{spc,trace2,warehouse360,processorderhistory,envmon}/frontend/vite.config.ts` | The 75% backend mandate has no frontend mirror in 5 of 7 frontends; CI passes even at 0%. |
| FE-04 | P1 | Zero `React.lazy()` / dynamic imports across the seven frontends | grep `apps/*/frontend/src` | SPC (control charts), W360 (heavy grid), trace2 (lineage tree) all ship as single chunks; first-paint penalty on the field. |
| FE-05 | P1 | Root-level `<ErrorBoundary>` missing in SPC, W360, trace2, POH | `apps/{spc,warehouse360,trace2,processorderhistory}/frontend/src/App.tsx` | Any unhandled exception unmounts the whole app — easy regression risk under shared shell. |
| FE-06 | P2 | `(window as any).__navigateToPourAnalytics` cross-app navigation | `apps/processorderhistory/frontend/src/App.tsx:104-140` | Restate in `shared-app-context`. |
| FE-07 | P2 | TanStack Query version drift between apps (`^5.99.0` vs `^5.100.9`) | `apps/warehouse360/frontend/package.json`, `apps/processorderhistory/frontend/package.json` vs siblings | Peer-dep negotiation under platform shell can hit subtle cache-invalidation differences. |
| FE-08 | P2 | Vite `manualChunks` defined in 4 apps, missing in `processorderhistory` and `trace2` | `apps/{processorderhistory,trace2}/frontend/vite.config.ts` | Unpredictable vendor chunks under platform shell. |
| FE-09 | P2 | Cache policy fragmented: per-hook `staleTime` in envmon, central `staleTime: 60s` in CQ, ad-hoc fetch in SPC/POH/trace2 | `apps/envmon/.../hooks/*`; `apps/connectedquality/frontend/src/App.tsx`; `apps/spc/frontend/src/api/*` | No `shared-frontend-api` cache-policy module — `useEntityQuery` is one step short of being the canonical home. |
| FE-10 | P3 | SPC Tailwind dead config (also TODO.md) | `apps/spc/frontend/tailwind.config.ts`; `apps/spc/frontend/package.json` | Tailwind devDep with no Tailwind utility usage — delete. |
| FE-11 | P3 | Hardcoded UI strings in SPC `Sidebar.tsx` ("Kerry"); persona names persisted untranslated | `apps/spc/frontend/src/.../Sidebar.tsx`; envmon localStorage | Missed i18n keys; not all UX flows pass `audit:i18n`. |
| FE-12 | P3 | A11y sparse: ~115 aria/role usages total; no `aria-live`/`aria-busy` on loading skeletons in `shared-ui` | `libs/shared-ui/src/components/Spinner.tsx`, `Card.tsx` | Field operators using screen readers / focus order are under-served. |
| FE-13 | P3 | Routing pattern fragmented per app (W360 has `routing.ts`; SPC/trace2/envmon parse `window.location.search`) | `apps/warehouse360/frontend/src/routing.ts` vs siblings | Deep-link restoration & back-button behaviour differs per app under the shell. |

**Healthy:** every app imports `@connectio/shared-ui` Kerry tokens at root; no Carbon/MUI/Tailwind usage in production code; all 13 locales present in `libs/shared-frontend-i18n/src/locales/`; `shared-frontend-api` `fetchJson()` enforces `x-request-id` and `credentials:'include'`; Playwright E2E config in CI matrix-runs against UAT for 6 apps.

### 2.4 Shared libraries

| ID | Sev | Title | Evidence | Diagnosis |
|---|---|---|---|---|
| LIB-01 | P1 | `shared-db` interrogate floor 32% — lowest in the repo, and it owns the SQL runtime | `libs/shared-db/pyproject.toml [tool.interrogate]` | Lowest-documented module is also the most consequential; ratchet target should be 75% inside this slice. |
| LIB-02 | P1 | `shared-auth` interrogate floor 43%; JWKS expiry + dev-mode bypass not fully covered | `libs/shared-auth/pyproject.toml`; `libs/shared-auth/tests/` | Security-sensitive code under-documented and under-tested. |
| LIB-03 | P2 | `shared-trace` underutilised by ConnectedQuality | see BE-06 | Move CQ trace router onto `shared-trace.TraceCoreDal`. |
| LIB-04 | P2 | `shared-geo` appears orphaned (no incoming imports from `apps/`) | `libs/shared-geo/src/**` | Either wire it into envmon spatial_config / W360 plant context, or delete. |
| LIB-05 | P2 | `shared-ui` has no Storybook stories and no RTL/a11y test files | `libs/shared-ui/src/**/__tests__` (absent); `nx.json` Storybook plugin present | Design system shipped without behavioural / a11y guarantees. |
| LIB-06 | P2 | `shared-ui` missing form primitives and chart abstractions | grep `libs/shared-ui/src/components` | Each app reinvents forms (validation, error display) and chart wrappers. |
| LIB-07 | P3 | `shared-reporting` appears partially used (graphTransformers test only) | `libs/shared-reporting/src/**` | Clarify status — production library or experimental? |
| LIB-08 | P3 | `shared-db` single TTL cache, no namespace per app | `libs/shared-db/src/.../core.py:199-220` | Two apps issuing the same statement with the same params share a cache slot — fine for read-only gold views, but worth documenting and adding a namespace if any app starts running plant-scoped writes. |

**Healthy:** `shared-ddd` and `shared-manufacturing` are pure (no fastapi/databricks/pydantic/sqlalchemy imports) and ride at 93% docstring coverage; `shared-frontend-api` provides typed TanStack Query hooks; `shared-frontend-i18n` 13 locales validated by pre-commit; `shared-playwright` page objects (KPICard, DataTable, Drawer, PlantContextBar) are reused.

### 2.5 Tests, coverage, CI

| ID | Sev | Title | Evidence | Diagnosis |
|---|---|---|---|---|
| QA-01 | P1 | ConnectedQuality unit-test surface is tiny (3 backend tests, 0 E2E) | `apps/connectedquality/backend/tests/`; `apps/connectedquality/e2e/` | The cross-app facade is the riskiest aggregator and the least tested. |
| QA-02 | P1 | `--cov-branch` not enforced on any backend | TODO.md "Backend `--cov-branch`" | Line coverage gates hide branch gaps; every backend reports without `--cov-branch`. |
| QA-03 | P1 | Frontend coverage thresholds missing on 5 of 7 frontends | see FE-03 | Pair with FE-03. |
| QA-04 | P2 | SPC backend coverage floor 40% (interrogate) and trace2 57% | `apps/spc/backend/pyproject.toml`, `apps/trace2/backend/pyproject.toml` | Materially below the 75% target. |
| QA-05 | P2 | E2E coverage uneven: CQ=0, envmon=1, POH=2; W360/SPC/trace2/platform=4–5 each | `apps/*/e2e/*.spec.ts` | Critical user journeys (CLAUDE.md §6) not all gated by `@smoke`. |
| QA-06 | P2 | `nx e2e` target not defined in `nx.json`; E2E runs via raw `npx playwright` | `nx.json` `targetDefaults`; `.github/workflows/ci.yml` | `nx affected` cannot skip unaffected E2E shards; CI runs the full matrix on every main push. |
| QA-07 | P3 | `interrogate` is `uv tool install`-ed inside the CI step instead of pinned alongside dev-dependencies | `.github/workflows/ci.yml` interrogate step | Latent drift; pin in `pyproject.toml` and call via `uv run`. |
| QA-08 | P3 | CodeQL action floats `@v3` major tag | `.github/workflows/ci.yml` | Pin to a release SHA like the rest. |

**Healthy:** governance test suite (`test_semantic_model_governance.py`, `test_ddd_architecture_guardrails.py`, `test_gold_view_contracts.py`, `test_deploy_app.py`, `test_platform_build.py`, `test_check_wheel_versions.py`) is comprehensive; `nx affected` driven CI; gold-view contract smoke runs once per main push against live UAT; release-please configured for 6 apps; npm `overrides` neutralise known transitive CVEs.

### 2.6 Docs, ai-context, packaging

| ID | Sev | Title | Evidence | Diagnosis |
|---|---|---|---|---|
| DOC-01 | P2 | README claims **React 19**; repo runs **React 18.3.1** | `README.md` "Stack at a Glance"; `apps/*/frontend/package.json` | Misleading on a public-facing onboarding doc. |
| DOC-02 | P2 | ADRs (`docs/adr/001-004`) lack formal status markers (accepted/superseded/rejected) | `docs/adr/*.md` | Decision history unreadable without opening each file; add a one-line `Status:` and an ADR INDEX. |
| DOC-03 | P2 | `apps/connectedquality` and `apps/platform` lack their own `docs/` while the 5 vertical apps have one | `apps/{connectedquality,platform}/docs` (absent) | The two pieces that integrate everything else have the least docs. |
| DOC-04 | P3 | `apps/platform/standalone` contents undocumented in the platform README | `apps/platform/standalone/**` | `build.py` copies them into `static/<slug>/` but their provenance isn't traceable in repo docs. |
| DOC-05 | P3 | `interrogate_badge.svg` checked into repo root | repo root | Generated artefact in source control — move to `docs/` or gitignore. |
| DOC-06 | P3 | `graph.json` (97 KB) checked into repo root | repo root | Looks like a one-shot Nx graph dump; should not live in source. |

**Healthy:** CLAUDE.md, ARCHITECTURE.md, GEMINI.md, CONTRIBUTING.md, SECURITY.md all current and cross-referenced; `ai-context/semantic-model/entities.yaml` covers `gold_inspection_lot`; pre-commit hooks match CI; `scripts/check_wheel_versions.py` is run inside CI before `check:repo`.

---

## 3. Prioritised sliced plan

Six numbered slices, each scoped to roughly one engineer-week, each independently shippable. Severity column maps to findings in §2.

> Convention: every slice ends with `npm run check:repo`, `npm run audit:frontend:strict`, the relevant `nx affected -t test`, and an updated row in `TODO.md`. No slice merges without an interrogate ratchet matching the new floor.

### Slice 0 — Pre-flight hygiene (½ day)

Tiny, low-risk fixes that clear the way for the rest of the plan.

| Step | Files |
|---|---|
| Update README "Stack at a Glance" to React 18.3.1 (DOC-01) | `README.md` |
| Add `.gitignore` for `interrogate_badge.svg` and `graph.json`; delete current copies (DOC-05, DOC-06) | repo root |
| Pin `interrogate` in root `pyproject.toml [tool.uv]` dev-dependencies; replace `uv tool install` in CI with `uv run interrogate` (QA-07) | `pyproject.toml`, `.github/workflows/ci.yml` |
| Pin CodeQL action to a release SHA (SEC-06, QA-08) | `.github/workflows/ci.yml` |
| Delete SPC `tailwind.config.ts` and the Tailwind devDep (FE-10) | `apps/spc/frontend/` |

**Exit:** CI green, no behaviour change.

### Slice 1 — Security hardening (1 sprint, ~5 days)

Closes the remaining 20% of the security surface.

| Step | Findings | Files |
|---|---|---|
| Add CSP (`default-src 'self'; frame-ancestors 'none'`) and HSTS (`max-age=31536000; includeSubDomains`) to `SecurityHeadersMiddleware`; opt-out flag for local dev | SEC-02 | `libs/shared-api/src/shared_api/middleware.py` |
| Scope Databricks bundle `root_path` to a SP-owned folder (`/Workspace/Apps/connectio-rad/<app>/<target>`); add explicit `permissions:` with `CAN_MANAGE` for SP and `CAN_USE` for deploy operators across all 7 `databricks.yml` files | SEC-01 / TODO M6 | `apps/*/databricks.yml` |
| Verify `enable_docs=False` (or env-gated) for production app factories; add a `test_docs_disabled_in_prod` governance test | SEC-05 | `libs/shared-api/src/shared_api/app_factory.py`, `scripts/tests/` |
| Replace EnvMon localStorage persistence with `sessionStorage` and TTL; clear on logout event | SEC-04 | `apps/envmon/frontend/src/context/EMContext.tsx` |
| Move POH `__navigateTo*` window globals into `shared-app-context` `useAppRouter` extension | SEC-03 / FE-06 | `libs/shared-app-context/src`, `apps/processorderhistory/frontend/src/App.tsx` |
| Add an `allow-listed IN` helper in `shared-db` (`run_sql_in()`) that takes a list of typed values and binds as `:p0,:p1,...`; migrate EnvMon plants DAL onto it | BE-05 | `libs/shared-db`, `apps/envmon/.../dal/plants.py` |

**Exit:** all CI gates green; manual smoke through `audit:frontend:strict`; `databricks bundle validate --target uat` clean on all 7 apps; SECURITY.md updated.

### Slice 2 — Test & docstring ratchet (1 sprint)

Move the floors that protect everything else.

| Step | Findings | Files |
|---|---|---|
| Add `--cov-branch` to all 7 backends; set initial branch floor to current actual value | QA-02 / TODO | `apps/*/backend/pyproject.toml` |
| Add `coverage.thresholds { lines/branches/functions/statements: 75 }` to all 7 frontend `vite.config.ts`; if a frontend is currently below, set the floor at its actual value and file a ratchet ticket | FE-03 / QA-03 | `apps/*/frontend/vite.config.ts` |
| Ratchet interrogate gates: `shared-db` 32→55, `shared-auth` 43→60, `spc-backend` 40→55, `trace2-backend` 57→65 (one ratchet step; the rest follow per slice) | LIB-01, LIB-02, QA-04 | per `pyproject.toml` |
| Write 8–10 ConnectedQuality unit tests (one per cross-app endpoint in the importlinter whitelist) and 3 `@smoke` E2E specs (alarms, envmon, trace) | QA-01, QA-05 | `apps/connectedquality/backend/tests/`, `apps/connectedquality/e2e/` |
| Define an `nx e2e` target in `nx.json` `targetDefaults`, wire each app's `project.json` to it, switch CI to `npx nx affected -t e2e` | QA-06 | `nx.json`, `apps/*/project.json`, `.github/workflows/ci.yml` |

**Exit:** every backend `pyproject.toml` and every frontend `vite.config.ts` carries a numeric floor; ConnectedQuality has at least one `@smoke` per endpoint group; `nx affected -t e2e` is the canonical command.

### Slice 3 — Frontend uniformity (1 sprint)

The frontends should look interchangeable.

| Step | Findings | Files |
|---|---|---|
| Roll back `noImplicitAny: false` and `noUnusedLocals: false` in W360 tsconfig; fix the resulting compile errors in a separate commit | FE-02 | `apps/warehouse360/frontend/tsconfig.app.json` + downstream |
| Align all apps to a single TanStack Query version pinned in the root `package.json`; add an `npm-check-versions` step to `check:repo` | FE-07 | `package.json`, `apps/*/frontend/package.json` |
| Add a root `<ErrorBoundary>` from `shared-ui` to SPC, W360, trace2, POH | FE-05 | `apps/{spc,warehouse360,trace2,processorderhistory}/frontend/src/App.tsx` |
| Add `manualChunks` to the two missing apps using the same vendor split as the four already-configured | FE-08 | `apps/{processorderhistory,trace2}/frontend/vite.config.ts` |
| Introduce `useCachePolicy(domain)` in `shared-frontend-api` returning the canonical `staleTime`/`gcTime` per data-class (metadata, kpi, trace, alarms); migrate envmon and CQ first | FE-09 | `libs/shared-frontend-api/src/cache.ts`, `apps/envmon`, `apps/connectedquality` |
| Add `React.lazy()` chunking for: SPC chart pages, W360 dispensary grid, trace2 lineage tree | FE-04 | `apps/{spc,warehouse360,trace2}/frontend/src/routes/*` |
| Move POH `__navigateTo*` to `shared-app-context` (continues from Slice 1) | FE-06 | already covered above |

**Exit:** strict TS, single TanStack Query version, all apps boot with an error boundary, all heavy routes lazy-loaded.

### Slice 4 — Backend / DAL consolidation (1 sprint)

Reduce duplication and stop swallowing failures.

| Step | Findings | Files |
|---|---|---|
| Replace every bare `except Exception:` in read-paths with a typed exception, structured log via `shared-api.observability`, and re-raise or convert to a documented 5xx | BE-01 | envmon queries, POH dashboards router, trace2 utils/db |
| Promote SPC's tiered cache + query-audit hook and CQ's semaphore into `shared-db` (`run_sql_async(..., cache_tier=..., concurrency_key=...)`); delete the 4 per-app `utils/db.py` wrappers | BE-02 | `libs/shared-db/src/.../core.py`, `apps/{spc,envmon,trace2,connectedquality}/backend/.../utils/db.py` (delete) |
| Update `template_backend.main` to use `ConnectIoApp` and the standard probe; re-run `scripts/validate_new_app.py template` | BE-03 | `apps/template/backend/.../main.py` |
| Switch platform's `/api/health` and `/api/ready` to `ConnectIoApp` aggregated probes; readiness must report each bundled backend | BE-04 | `apps/platform/backend/main.py` |
| Migrate `connectedquality` trace routes to call `shared-trace.TraceCoreDal`; remove duplicated tree-building | BE-06, LIB-03 | `apps/connectedquality/backend/.../routers/trace.py`, `libs/shared-trace/src` |

**Exit:** `.importlinter` still green; pytest passes per backend; `shared-db` interrogate ratchet steps up (already in Slice 2 plan).

### Slice 5 — Shared-lib & docs cleanup (½ sprint)

| Step | Findings | Files |
|---|---|---|
| Decide `shared-geo`: integrate (envmon spatial_config & W360 plant context) or delete; document the call sites | LIB-04 | `libs/shared-geo`, ADR |
| Same call on `shared-reporting`: promote to production (wire from POH/W360) or move to a `playground/` outside the workspace | LIB-07 | `libs/shared-reporting` |
| Add Storybook stories for the 10 most-used `shared-ui` components; add RTL + axe-core a11y tests; wire Storybook into `build` via the existing `@nx/storybook` plugin | LIB-05, FE-12 | `libs/shared-ui/src/components/**` |
| Add `<Form>`, `<Field>`, `<ChartContainer>` primitives to `shared-ui` once Storybook scaffold is in | LIB-06 | `libs/shared-ui` |
| Create `apps/connectedquality/docs/README.md` and `apps/platform/docs/README.md` with mount-point + router discovery diagrams | DOC-03 | new files |
| Add `Status: Accepted / Superseded by ADR-NNNN` headers to ADRs 001–004 and create `docs/adr/INDEX.md` | DOC-02 | `docs/adr/*.md` |
| Add a `apps/platform/standalone/README.md` documenting each standalone bundle | DOC-04 | new file |

**Exit:** every shared lib has either Storybook/tests/docs or is removed; ADR index in place; every app has a `docs/`.

### Slice 6 — Backlog & ratchet (continuous)

Anything not in Slices 0–5 stays in `TODO.md`. Per sprint:

- Ratchet interrogate floors +5 percentage points per lib/app until each hits 75.
- Ratchet `--cov-branch` floors +5 percentage points per backend until each hits 75.
- Convert the next P3 finding into a P2 once its preceding work clears.

---

## 4. Cross-cutting recommendations

1. **Promote `shared-db` to first-class API surface.** It already carries the cache, the EXTERNAL_LINKS disposition, `tbl()`, and (after Slice 4) the audit hook and concurrency primitive. Document it as the only sanctioned way to talk to Databricks SQL and add an importlinter contract forbidding any other backend from importing `databricks` directly.
2. **Standardise app shape via `template`.** Every gap surfaced in this review (BE-03, BE-04, FE-03, FE-05, FE-07, FE-08) has a corresponding choice in the template app. Once Slice 3+4 are done, regenerate `apps/template` from the new conventions and add `scripts/validate_new_app.py` checks for the new shape.
3. **Treat ADR-as-source.** Make ADR-driven decisions blocking: any change that touches `shared-*` or alters a bounded context must reference an ADR. Add a CI step that warns when a `libs/shared-*` change does not touch `docs/adr/`.
4. **Push for branch coverage as the headline metric** rather than line coverage. Once `--cov-branch` is wired (Slice 2), the line floor can stay at 75 and branch should ratchet from current-floor to 60–70 over Slices 3–6.
5. **Add `nx affected -t e2e`** to PR gates so the live-UAT matrix runs only when a frontend actually changed. Today every main push runs the full 6-app matrix.

---

## Appendix A — Severity legend

- **P0** — ship-blocker; merge today (none found).
- **P1** — fix this sprint; risk to security, correctness, or DoD.
- **P2** — next slice; meaningful quality/UX/perf gap.
- **P3** — backlog; hygiene/documentation/dead code.

## Appendix B — What is already very good

- Importlinter contracts with explicit aggregator-whitelist for ConnectedQuality.
- Semantic-model governance test enforces every `tbl()`/`silver_tbl()` reference against `ai-context/semantic-model/entities.yaml`.
- Gold-view contract smoke runs against live UAT before every main-merge E2E matrix.
- OpenAPI drift gate (`scripts/generate_openapi.py --check`) catches schema changes without a regen.
- Wheel-bundled platform build is reproducible (`scripts/check_wheel_versions.py` enforces version bumps on source change).
- PII redaction in `shared-api.observability`; tokens excluded from `UserIdentity` `repr`.
- Per-app importlinter source modules cover every bounded context defined in CLAUDE.md.
- 13-locale i18n with a pre-commit `validate_i18n.py` hook.
- Release-please configured for 6 of 7 vertical apps with Python release type and per-app CHANGELOG.
- Pre-commit chain (gitleaks, ruff, prettier, YAML/TOML, large-file 500 KB cap, merge-conflict, architecture lints, generator tests, template validation, i18n validation) matches CI exactly.

## Appendix C — Audit trail

| Pass | Scope | Method |
|---|---|---|
| Backend / DAL / DDD | apps/*/backend, libs/shared-{api,db,auth,ddd,manufacturing} | targeted Explore agent |
| Frontend | apps/*/frontend, libs/shared-{ui,frontend-api,frontend-i18n,app-context,reporting} | targeted Explore agent |
| Shared libs + tests/CI | libs/* and `.github/workflows/ci.yml` and `scripts/tests/` | targeted Explore agent |
| Security / docs / packaging | full repo + `apps/platform/scripts/build.py` + `ai-context/` | targeted Explore agent |
| Synthesis | this document | primary author |
