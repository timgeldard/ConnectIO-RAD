# ConnectIO AI Agent & Architectural Standards

This document serves as the central index for architectural patterns and "gotchas" enforced across the ConnectIO-RAD platform. These standards are consumed by both human developers and AI agents (Gemini, Claude, Cursor).

## 🏗️ Core Architectural Patterns

### 1. The 3-Model Pattern (APX)
To ensure separation of concerns and type safety across the stack, all APX-based modules MUST follow the 3-Model pattern:
- **Domain Model**: Pure Python classes representing business logic and entities.
- **Persistence Model**: Database schemas (SQL/Delta) and DAL objects.
- **API Model (DTO)**: Pydantic schemas for request/response validation.

*Detailed documentation: [`.agents/skills/databricks-app-apx/backend-patterns.md`](../.agents/skills/databricks-app-apx/backend-patterns.md)*

### 2. Operation ID Conventions
Standardized `operation_id` strings are required for OpenAPI generator compatibility and frontend hook generation.
- Format: `[verb][Entity][Context]` (e.g., `getPlantStatus`).

## 📊 Dashboard Development (AI/BI)

### Text Widget "Gotcha"
- **Concatenation**: Multiple items in the `lines` array of a `multilineTextboxSpec` are **concatenated on a single line** at runtime, NOT displayed as separate lines.
- **Formatting**: Use explicit `\n` or separate text widgets if multi-line display is required.

*Detailed specifications: [`.agents/skills/databricks-aibi-dashboards/1-widget-specifications.md`](../.agents/skills/databricks-aibi-dashboards/1-widget-specifications.md)*

## 🤖 AI Agent Configuration

The "Unified Agent Context" is located in:
- **`/.agents/config/`**: Tool-specific configurations (MCP, Cursor, Codex).
- **`/.agents/skills/`**: The authoritative library of platform-specific skills and Databricks integration patterns.

---
*This document is part of the "Quality & Technical Debt" initiative to centralize tribal knowledge and automated gates.*
