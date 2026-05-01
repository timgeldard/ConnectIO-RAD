# Connected Quality Consolidation Plan

**Branch:** `ConnectedQuality-Consolidation`  
**Date:** 2026-04-30  
**Status:** DRAFT

## 1. Vision

Consolidate the diverse quality and operations applications (SPC, EnvMon, Trace2, POH) into a unified "Connected Quality" suite. This involves standardizing the visual language (Kerry Design System), unifying the frontend architecture, and consolidating backend data access to reduce maintenance overhead and improve user experience.

## 2. Strategic Objectives

1.  **Unified Experience**: A single sidebar and shell for all apps.
2.  **Shared UI Library**: Move visual primitives (`Icon`, `KPI`, `Sparkline`, `StatusBadge`, `Button`) into `libs/shared-frontend-ui`.
3.  **Architectural Alignment**: All apps must use `shared-db` for SQL execution and `shared-frontend-api` for client-side state.
4.  **Zero Drift**: Eliminate duplicate SQL queries across apps by moving shared logic to `libs/shared-trace` or `libs/shared-db`.

## 3. Consolidation Phases

### Phase 1: Shared UI Foundation
- Create `libs/shared-frontend-ui`.
- Port the icon system and base tokens (`kerry-tokens.css`) from `apps/spc`.
- Standardize the `KPI` and `Sparkline` components from both `spc` and `poh`.
- Implement a shared `Button` and `Modal` system.

### Phase 2: Universal App Shell
- Develop a shared `AppShell` in `libs/shared-frontend-ui`.
- Sidebar should support multi-app navigation:
    - **Operate**: Vessel Planning, Order List (from POH).
    - **Quality**: SPC Charts, Scorecard, EnvMon (Map/Visuals).
    - **Trace**: Recall Readiness, Lineage (from Trace2).
- TopBar should handle global search (⌘K), notifications, and profile across all domains.

### Phase 3: POH Design Migration
- Complete the Kerry migration for POH pages (Order List, Detail, Planning Board) using the shared components.
- Align POH's `pour-` classes with the standard Kerry tokens.

### Phase 4: EnvMon & Trace2 Integration
- Update EnvMon to use the shared `AppShell` and `KPI` components.
- Refactor Trace2 to eliminate its local theme overrides and use the shared tokens.

### Phase 5: Backend & Data Contract Consolidation
- Audit `reports/consolidation/sql-table-map.md`.
- Move shared DAL logic for quality results (`gold_batch_quality_result_v`) and lineage into `libs/shared-trace`.
- Standardize the audit logging (`spc_query_audit`) across all apps.

## 4. Immediate Next Steps (Current Sprint)

1.  [ ] **Initialize `libs/shared-frontend-ui`**: Set up the package structure and port the tokens.
2.  [ ] **Standardize Sidebar**: Design a sidebar that can handle the navigation requirements of all 4 apps.
3.  [ ] **POH OrderList Kerry Migration**: Apply the new design to the primary POH entry point.
4.  [ ] **Consolidate Quality DAL**: Move `get_quality_results` type logic to a shared location.

## 5. Risk Assessment

| Risk | Mitigation |
|---|---|
| Bundle size increase | Use tree-shaking and avoid importing the entire library if only a few components are needed. |
| Navigation complexity | Use a clear grouping strategy in the sidebar (Operate/Quality/Trace). |
| Data permission drift | Maintain strict Unity Catalog view mapping in `entities.yaml`. |
