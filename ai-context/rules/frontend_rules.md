# Frontend Development Rules

> Conventions for frontend code in Databricks apps.
> These apply to React/TypeScript frontends (Vite build toolchain).

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18+ | Functional components only, no class components |
| Language | TypeScript | Strict mode, no `any` unless justified |
| Build | Vite | Output to `frontend/dist/`, served by FastAPI |
| Styling | Inline styles / CSS variables | No Tailwind, no CSS modules (keep deps minimal) |
| Charts | Inline SVG or lightweight library | Prefer custom SVG over heavy chart libraries |
| State | React useState/useEffect | No Redux, no Zustand unless app complexity demands it |
| Fonts | Inter (sans), JetBrains Mono (mono), Newsreader (serif) | Loaded via Google Fonts |

## 2. API Communication

### 2.1 Request Pattern
- All data endpoints use POST with JSON body
- Always include `credentials: "include"` for auth token forwarding
- Use the `postJson<T>(path, body)` helper from `data/api.ts`

### 2.2 Response Parsing
- **All numeric values from the backend arrive as STRINGS** (SQL Statement API behaviour)
- Use `parseFloat(value) || 0` for quantities
- Use `parseInt(value, 10) || 0` for counts
- Use `Date.parse(value)` for dates — check `Number.isNaN()` before using
- IDs (material_id, batch_id) are ALWAYS strings — never parseInt

### 2.3 Error Handling
- Backend returns `{ detail: string }` on error
- 404 = no data found (expected for unknown batch) — show friendly "no data" state
- 500 = server error with reference ID — show the reference ID to the user
- 503 = data layer unavailable — show "service temporarily unavailable"
- Always implement loading → error → ready state machine

## 3. Type Safety

### 3.1 API Response Types
- Define raw response types that match `api_payload_examples.json` EXACTLY
- Define clean domain types with parsed numbers/dates
- Convert in a single mapping function — never scatter parseFloat across components
- See `data/api.ts` → `buildBatch()` pattern as reference

### 3.2 Null Handling
- Every API field can be null — define types accordingly
- Use fallbacks: `value ?? 0` for numbers, `value ?? "—"` for display strings
- Never render `null` or `undefined` in the UI

## 4. UI Conventions

### 4.1 Design System
- Use CSS custom properties for theming: `var(--paper)`, `var(--ink)`, `var(--accent)`
- Support light and dark themes via variable swapping
- Use monospace font for IDs, codes, quantities
- Use sans-serif for labels and body text
- Use serif for brand name / titles only

### 4.2 Number Formatting
- Quantities: 1 decimal place with thousands separator (e.g., "23,975.0 KG")
- Counts: integer with no decimals (e.g., "3")
- Percentages: 1-2 decimal places with % suffix
- Use tabular-nums font variant for aligned columns

### 4.3 Status Colours
| Status | Colour | CSS Variable |
|---|---|---|
| Released / Pass / Good | Green `#10b981` | `--status-good` |
| Blocked / Rejected / Critical | Red `#ef4444` | `--status-bad` |
| QI Hold / Warning | Amber `#f59e0b` | `--status-warn` |
| Unknown / Muted | Grey `#9ca3af` | `--status-muted` |

### 4.4 Empty States
- Always design for empty data — never show a blank screen
- Use a clear message explaining what data is missing and why
- Offer guidance: "Try a different batch ID" or "No deliveries recorded"

## 5. Component Patterns

### 5.1 Page Components
- Each page is a standalone component in `pages/`
- Each page manages its own data fetching via useEffect
- Each page implements loading/error/ready states
- Pages receive `batch: Batch` prop for current context

### 5.2 State Machine Pattern
```typescript
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string; status?: number }
  | { kind: "ready"; data: LoadedData };
```

### 5.3 KPI Cards
- Use the `<KPI>` component for metric display
- Include label, value, unit, and optional tone (good/bad/warn/muted)
- Include sub-text for context (date range, comparison, etc.)

## 6. Build and Deployment

- Frontend builds to `frontend/dist/`
- FastAPI serves `dist/index.html` as SPA fallback
- Static assets served from `dist/assets/`
- `app.yaml` must include the frontend build command
- No `.env` files in production — use Databricks app environment variables
