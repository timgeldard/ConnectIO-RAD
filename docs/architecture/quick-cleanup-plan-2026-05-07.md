# Quick Cleanup Sprint — Implementation Plan

**Source review:** `docs/architecture/review-2026-05-07.md`
**Date:** 2026-05-07
**Scope:** H6, L9, L10, M5, M7, M8, plus a new wheel-version-bump check surfaced during the C1-C5 deploy.
**Estimated effort:** ~3 hours.

---

## Context

The C1–C5 critical fixes are deployed and verified. This plan rolls up six small findings plus one new gotcha into a single cleanup pass. None of these is individually worth a session; bundled they remove a lot of friction.

Order of work (low-risk → low-risk; safe to land in any order):

1. **H6** — refresh `CLAUDE.md` to reflect the seven apps (currently lists five).
2. **L9** — add `CODEOWNERS`.
3. **L10** — add `.github/pull_request_template.md`.
4. **M5** — lower `request.completed` log level from INFO to DEBUG.
5. **M7 + M8** — pre-commit hook: glob the per-app architecture tests, AND add the central DDD guardrail.
6. **Wheel-version guard** — CI script that fails when a packaged source directory changed but its `pyproject.toml` version did not.

---

## H6 — refresh `CLAUDE.md`

**Goal:** day-one orientation file should be accurate.

**Changes:**
- Add `connectedquality` row (cross-app facade for envmon/spc/trace2/lab).
- Add `platform` row (the unified shell that bundles CQ + POH + W360).
- Brief line under "Repo Structure" explaining the standalone-vs-platform distinction so newcomers (human or agent) understand why `apps/processorderhistory/backend/` and `apps/platform/processorderhistory_backend/` (the latter installed from a wheel) are both in the tree.

**File:** `CLAUDE.md`.

---

## L9 — `CODEOWNERS`

**Goal:** make code-review routing explicit.

**Changes:**
- Single `* @timgeldard` rule as a starting baseline (single-maintainer repo today). Per-app rules can be added later as the team grows.

**File:** `.github/CODEOWNERS` (new).

---

## L10 — PR template

**Goal:** structured PR descriptions; less cognitive load on reviewers.

**Changes:**
- Standard sections: Summary, Why, Test plan, Risk / rollback, Related work.
- Specifically reminds the author to bump package versions if they touched a wheel-bundled package (closes the today-just-bit-us gotcha at the human-checklist layer too).

**File:** `.github/pull_request_template.md` (new).

---

## M5 — quieten `request.completed` log

**Goal:** stop drowning the log channel with one INFO line per request when the app is healthy. Keep INFO/WARN reserved for actually-interesting events (latency-budget breaches, etc.).

**Changes:**
- `libs/shared-api/src/shared_api/middleware.py` lines 65–70: `logger.info(...)` for the `request.completed` line → `logger.debug(...)`. Latency-budget-breach logging at the next branch (already INFO) stays unchanged.

**File:** `libs/shared-api/src/shared_api/middleware.py`.

---

## M7 + M8 — pre-commit hook fixes

**Goals:**
- M7: stop enumerating each app's `test_architecture_boundaries.py` by full path. The original plan was to glob them, but during execution we discovered `pytest`'s `conftest.py` collision blocks running the per-app tests in one invocation — so the actual fix dropped them entirely from pre-commit and let `nx affected -t test` cover them in CI per app.
- M8: run the central `scripts/tests/test_ddd_architecture_guardrails.py` so unauthorized bounded contexts and cross-cutting violations fail at commit time, not on push.

**Changes:**
- `.pre-commit-config.yaml`: replace the seven hard-coded test paths with a single invocation of `scripts/tests/test_ddd_architecture_guardrails.py`. The central guardrail AST-walks every domain/application/router file across all apps and is broader than the per-app tests; per-app tests still run under `nx affected -t test` in CI.

**Verification:**
- `pre-commit run ddd-guardrails --all-files` passes on a clean tree.
- Force a violation (temporarily import `fastapi` in any `domain/*.py`) and confirm the hook flags it.

**File:** `.pre-commit-config.yaml`.

---

## Wheel-version guard (new)

**Goal:** prevent a recurrence of today's "the wheel changed but pip skipped reinstall because the version is unchanged" gotcha. The fix is mechanical: if a wheel-bundled package's source changes between base and head, its `pyproject.toml` `version` must change too.

**Changes:**
- New script `scripts/check_wheel_versions.py`:
  - Walks the 12 platform-bundled packages (the same list the platform's `scripts/build.py` knows about).
  - For each, checks `git diff --name-only <base>...<head> -- <pkg>/<dist_dir>/` for content-affecting changes (excludes `tests/`, `*.md`, `pyproject.toml` itself).
  - If any source change is present AND `pyproject.toml`'s `version` is unchanged between base and head, emit a failure naming the package and the version that needs bumping.
  - Exits 0 cleanly otherwise.
- New CI step in `.github/workflows/ci.yml`, after the existing `Lint affected` step, runs `python3 scripts/check_wheel_versions.py --base=$NX_BASE --head=$NX_HEAD`.
- Brief test in `scripts/tests/test_check_wheel_versions.py`: build two synthetic git refs (base/head) where the source changed but the version didn't, assert the script fails. Inverse test: same source, same version, assert it passes. Inverse test 2: changed source AND bumped version, assert it passes.

**Files:** `scripts/check_wheel_versions.py`, `scripts/tests/test_check_wheel_versions.py`, `.github/workflows/ci.yml`.

---

## Verification

After the sprint:

- `pre-commit run --all-files` passes on a clean tree.
- `npx nx affected -t test` still passes (no functional change to runtime code).
- `python scripts/check_wheel_versions.py --base=origin/main --head=HEAD` passes (current branch already has the W360 bump).
- A trial commit that edits `libs/shared-api/src/shared_api/middleware.py` without bumping its version is caught by the new check.
- `CLAUDE.md` reads accurate when opened cold.

---

## Sequencing & commits

One commit per discrete change so the history reads cleanly:

1. `docs(claude): refresh app inventory and platform-shell description (H6)`
2. `chore: add CODEOWNERS and PR template (L9, L10)`
3. `chore(shared-api): drop request.completed to DEBUG (M5)`
4. `chore(pre-commit): glob per-app guardrails and run central DDD test (M7, M8)`
5. `ci: enforce wheel-version bumps on packaged source changes`
6. `docs: log quick-cleanup-sprint completion in review-2026-05-07.md`

Push at the end of the sprint. No deploy needed — none of these affect runtime behaviour.

## Out of scope

- HIGH security findings (H1-H5). Those are larger and warrant their own session.
- M1-M4, M6, M9, M10 are bigger items not addressed here.
- Prod JWKS values (still need `databricks auth login --profile prod` first).
