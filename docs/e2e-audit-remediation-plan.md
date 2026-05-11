# ConnectIO-RAD: E2E and Playwright Testing Audit & Remediation Plan

## 1. Audit Summary (May 2026)

The current E2E testing infrastructure is well-architected but inconsistent in its implementation across the monorepo.

### Strengths
- **Modular Config**: Root `playwright.config.ts` is correctly extended by app-specific configs.
- **Shared Support**: `libs/shared-playwright` provides reusable Page Objects and fixtures.
- **Mocking**: `mockAllApiRoutes` allows for fast, stable PR gates without backend dependencies.

### Weaknesses
- **Low Data Fidelity**: E2E fixtures were using simplified IDs (e.g., `MAT-001`) that don't match production SAP patterns.
- **Coverage Gaps**: `EnvMon` and `POH` (Process Order History) have no E2E test suites implemented.
- **Surface-Level Testing**: The `Template` module E2E suite only checks for a single heading.
- **Browser Scope**: Testing is currently limited to Chromium, missing Firefox which is used by many plant ops teams.

---

## 2. Remediation Plan

### Phase 1: Realistic Data Alignment (COMPLETE)
- [x] Update `libs/shared-playwright/fixtures` with 8-12 digit numeric SAP IDs.
- [x] Update `Warehouse360`, `SPC`, and `Trace2` spec files to use high-fidelity identifiers.
- [x] Align E2E data with `shared_manufacturing.test_data` utility patterns.

### Phase 2: Coverage Expansion (COMPLETE)
- [x] **POH E2E Suite**: Implement OEE dashboard and Pours history journeys.
- [x] **EnvMon E2E Suite**: Implement MIC heatmap and floor plan navigation tests.
- [x] **Template module hardening**: Add structural tests for the metric grid and sidebar integration.

### Phase 3: Visual Regression Testing (COMPLETE)
- [x] Integrate `toHaveScreenshot()` into the `libs/shared-playwright` fixtures.
- [x] Capture baseline screenshots for `DataTable`, `KPICard`, and `PlatformShell`.
- [x] Run visual diffs on every PR affecting `libs/shared-ui`.

### Phase 4: Platform & Browser Validation (COMPLETE)
- [x] Enable **Firefox** project in `playwright.config.ts` for all suites.
- [x] Add **Mobile Chrome** (Tablet) project to validate dispensary and line-side workflows on handheld devices.
- [x] Standardize `data-testid` usage across all new React components.

---

## 3. Implementation Guidelines

### 3a. Locator Priority
1. `data-testid` (Public API)
2. ARIA Role + Name
3. Label Text
4. Heading Text

### 3b. Data Strategy
- Use `mockApi.ts` for PR/smoke tests to ensure stability and speed.
- Use live Databricks UAT endpoints for post-merge integration tests.
- Always use high-fidelity SAP IDs from `shared_manufacturing.test_data` generators.
