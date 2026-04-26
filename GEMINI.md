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

---

> **Note**: These mandates are foundational. Failure to follow them will result in the work being rejected by the system maintainer.
