# Core Engineering Mandates (Definition of Done)

Every coding agent MUST adhere to the following standards for any code modification or new feature. A task is NOT considered complete until these three criteria are met and verified.

## 1. Internal Code Documentation (10/10 Standard)
All new or modified code must be fully self-documenting:
- **Python**: PEP 257 compliant multi-line docstrings for every function, class, and module. Must include `Args:`, `Returns:`, and `Raises:` sections for complex logic.
- **TypeScript/React**: JSDoc annotations (`/** ... */`) for every exported interface, type, component, and custom hook. All component props MUST have individual descriptions.
- **Complexity**: Any non-obvious algorithm or business logic must have inline `//` or `#` comments explaining the "why," not just the "what."

## 2. External Documentation Updates
Documentation in the `/docs` and `apps/*/docs` directories must stay in sync with the codebase:
- **Architecture**: If a system component or data flow changes, update the relevant `architecture.md` and associated Mermaid diagrams.
- **API Reference**: Every new or modified API endpoint must be documented in the app's `api.md`, including a link to the interactive Swagger UI (`/docs`).
- **Setup**: Update `setup.md` if dependencies or environment requirements change.

## 3. Mandatory 100% Test Coverage for Changes
We maintain a strict "no regressions" and "verified logic" policy:
- **Coverage**: Any new or modified lines of code MUST have **100% unit test coverage**.
- **Verification**: You must run the relevant coverage command (e.g., `pytest --cov` or `vitest run --coverage`) and confirm that your changes are fully covered before submitting.
- **Infrastructure**: If an app lacks a testing framework, you MUST set it up (Vitest/Pytest) as part of your first task in that app.

## 4. Mandatory 100% i18n Translation Coverage
We support 16 standard languages (en, de, fr, es, ja, pt, id, ms, ga, pl, nl, uk, da, vi, zh-Hans, zh-Hant).
- **Enforcement**: Every frontend string MUST have a translation for ALL 16 languages in `src/i18n/resources.json`.
- **Validation**: `python3 scripts/validate_i18n.py` is enforced via pre-commit hook.
- **Drift**: All languages must have the exact same keys and placeholders as the English (`en`) reference.

## 5. DDD Frozen Boundaries Rule (Mandatory)
The architectural boundaries for core DDD apps are **Frozen** to prevent drift and regressions:
- **Placement**: All new business logic must be placed in the correct bounded context's `domain/` or `application/` layer.
- **Isolation**: The `domain/` layer must never depend on infrastructure, transport (fastapi), or sibling contexts' domain layers.
- **Communication**: Cross-context communication must flow through the target context's `application/` layer only.
- **Guardrails**: All changes MUST pass the architecture guardrail suite (`uv run pytest scripts/tests/test_ddd_architecture_guardrails.py`). Unauthorized new bounded contexts or boundary violations will result in PR rejection.
- **Glossary**: New domain terms must be added to `docs/domain-glossary.md` and aligned with the owning context's ubiquitous language.

## 6. Design System & Frontend Standards
The ConnectIO-RAD monorepo uses the **Kerry Design System** (custom tokens and components in `libs/shared-ui`).
- **Forbidden**: IBM Carbon Design System (`@carbon/*`) is deprecated and must not be used in new features.
- **Tokens**: All styling must use Kerry CSS variables (e.g., `var(--brand)`, `var(--surface-1)`). Hardcoded colors or Carbon tokens are prohibited.
- **Components**: Prefer components from `@connectio/shared-ui`. If a component is missing, build it in `shared-ui` following the Kerry tokens.
- **Theming**: Support for Light, Dark, and High-Contrast modes is required via the `useTheme()` hook and `data-theme` attribute.

## 7. Branch Protection & Git Workflow
Direct commits to the `main` or `master` branches are strictly forbidden:
- **Isolation**: All new features, bug fixes, or documentation updates MUST be performed on a dedicated feature or fix branch.
- **Review**: Changes must be submitted via Pull Request and pass all automated CI checks (Lint, Test, i18n, DDD Guardrails) before merging.
- **Agent Enforcement**: As an AI agent, you must always check the current branch and refuse to commit directly to `main`. If on `main`, you must create a new branch before making changes.

---

> **Note**: These mandates are foundational. Failure to follow them will result in the work being rejected by the system maintainer.
