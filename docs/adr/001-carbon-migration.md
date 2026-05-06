# ADR 001: Carbon Design System Migration to Kerry Design System

## Status
Accepted.

## Context
The ConnectIO-RAD monorepo has been using IBM Carbon Design System v11 in its frontends, particularly in the `envmon` application. While Carbon provided a strong foundation, we are moving towards a custom design language, "Kerry", to:
1.  **Reduce Bundle Size**: Carbon packages are heavy and introduce significant overhead.
2.  **Brand Alignment**: Kerry-specific branding requires deep customization of Carbon tokens, which is often complex and brittle.
3.  **Ownership**: A custom design system in `libs/shared-ui` allows for faster iteration and tighter integration with our specific domain needs (e.g., Databricks App performance, spatial visualizations).

## Decision
We will fully remove the dependency on IBM Carbon Design System v11 from the `envmon` frontend and align it with the emerging custom "Kerry" design system in `libs/shared-ui`.

### Key Tenets
- **Token-First**: All styles must be derived from shared Kerry tokens (`libs/shared-ui/src/tokens/`).
- **Component Parity**: The Kerry design system must provide accessible, functional equivalents for all Carbon components used (DataTable, Button, Modal, etc.).
- **Zero @carbon**: By the end of the migration, no `@carbon/*` packages should exist in the monorepo's `package.json` files.
- **Visual Fidelity**: Accessibility and visual support for high-contrast/dark modes must be maintained.

## Implementation Strategy
1.  **Phase 0: Inventory**: Identify all Carbon usage (mostly completed; `envmon` source is already largely using custom/shared components, but documentation and latent dependencies remain).
2.  **Phase 1: Build Kerry Foundation**: Establish tokens and core components in `libs/shared-ui`.
3.  **Phase 2: Incremental Migration**: Replace remaining Carbon or local custom components in `envmon` with shared Kerry components.
4.  **Phase 3: Cleanup**: Remove dependencies and update documentation.

## Consequences
- **Positive**: Smaller bundle sizes, improved brand consistency, and reduced external maintenance risk.
- **Negative**: Initial effort required to build and test custom components; risk of visual regressions.
- **Mitigation**: Storybook for visual testing; incremental component-by-component rollout.
