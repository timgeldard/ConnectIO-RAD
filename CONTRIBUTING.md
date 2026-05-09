# Contributing to ConnectIO-RAD

## Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (`pip install uv`)
- Node.js 20+ and npm
- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/databricks-cli.html) configured for UAT
- [pre-commit](https://pre-commit.com/) (`pip install pre-commit`)

## Local Setup

```bash
# Clone and install all dependencies
git clone <repo-url> && cd ConnectIO-RAD
uv sync --all-extras       # Python deps (all apps + libs in one venv)
npm install                 # Node deps
pre-commit install          # Install git hooks
```

## Branching Strategy

| Branch pattern | Purpose |
|---|---|
| `feature/<description>` | New features |
| `fix/<description>` | Bug fixes |
| `chore/<description>` | Tooling, deps, config changes |
| `docs/<description>` | Documentation only |

All work must be on a branch — direct commits to `main` are blocked.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(spc): add X-bar R chart export to CSV
fix(warehouse360): correct ABC classification boundary at 80%
chore(ci): pin databricks/setup-cli to v0.240.0
docs(arch): add authorization pattern section to ARCHITECTURE.md
```

Conventional commits are required for `release-please` to generate correct CHANGELOGs.

## Running Tests

```bash
# All affected tests (CI-equivalent)
npx nx affected -t test --base=main

# Single app backend
uv run --project apps/spc/backend pytest apps/spc/backend/tests/ -x -q

# Single app frontend
cd apps/spc/frontend && npm run test

# DDD guardrails (cross-app)
uv run --with pytest pytest scripts/tests/test_ddd_architecture_guardrails.py --tb=short
```

Coverage minimum is **75%** for all apps. CI will fail if coverage drops below the
threshold set in each app's `pyproject.toml` or `vite.config.ts`.

## Pull Request Process

1. Push your branch and open a PR against `main`
2. CI must pass (lint, typecheck, test, DDD guardrails, security scan)
3. At least one approving review is required (CODEOWNERS are auto-assigned)
4. Squash-merge or merge commit — no force-pushes to main

## DDD Architecture Rules

This repo enforces a four-layer DDD boundary:

```
router → application → dal → domain
```

- Routers: only call application layer functions
- Application layer: orchestration, auth guards, HTTPExceptions
- DAL: database queries only, no HTTP concerns
- Domain: pure data models, no I/O

Import violations fail CI via `scripts/tests/test_ddd_architecture_guardrails.py`.
They also run as a pre-commit hook.

## Deploying

```bash
# Deploy a specific app to UAT
python3 apps/<app>/scripts/deploy_app.py --profile uat

# Never deploy directly to production — production deploys go through the
# CI/CD environment gate (GitHub Environments: production) after merge to main.
```

## Getting Help

- Check `apps/<app>/docs/ARCHITECTURE.md` for app-specific design decisions
- Check `ai-context/` for semantic model and SQL conventions
- Open an issue or ping in the platform Slack channel
