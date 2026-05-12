# trace2 Genie integration (Phase 3b)

- **Status:** Backend + frontend port shipped on `feat/trace2-genie-integration`; awaiting deploy-time `TRACE2_GENIE_SPACE_ID` and one trivial wire-up after PR #54 lands.
- **Date:** 2026-05-12
- **Owner:** TBD (trace2 frontend lead)
- **Depends on:** PR #54 (`feat/trace2-advanced-traceability`) — only for the
  one-line wiring of `onExplainNode` on the advanced lineage graph, which
  lives on PR #54.  The Genie surface itself is fully usable without it
  (the floating "Ask Genie" trigger works on every page).

## What this is

Ports the POH `genie_assist/` backend + `genie/` frontend convention into
trace2 so operators can ask Genie about a focal batch or a specific
lineage transfer.  The Genie wiring is per-app (each app owns its Genie
Space at deploy time); the duplication with POH is intentional and
tracked for consolidation.

## What shipped

### Backend (`apps/trace2/backend/trace2_backend/genie_assist/`)

- `application/genie_client.py` — Databricks Genie Conversation API
  proxy.  Verbatim from POH except:
  - `compose_genie_content` shapes a trace2-specific page-context
    block (focal batch + optional selected transfer node).
  - `_space_id` reads `TRACE2_GENIE_SPACE_ID` first, falling back to
    the generic `GENIE_SPACE_ID` so single-space deployments still work.
- `router_genie.py` — same 4 endpoints as POH (`/genie/start`,
  `/genie/followup`, `/genie/message`, `/genie/query-result`).  Mounted
  at `/api/t2/genie/*` in standalone trace2 and at `/api/genie/*` in the
  platform shell (via `PLATFORM_ROUTERS`), matching the same dual-mount
  POH and SPC already use.

### Frontend (`apps/trace2/frontend/src/genie/`)

- `api.ts` — typed API client; calls `/api/genie/*` and lets
  `resolveTraceApiPath()` rewrite to `/api/t2/genie/*` standalone /
  `/api/genie/*` under the platform shell.
- `useGenieConversation.ts` — owns conversation state, polls for message
  completion with exponential-ish backoff (24 polls / 0.9s → 3.5s),
  hydrates tabular query results lazily.
- `pageContext.ts` — pure builders:
  - `buildLineageContext({view, batch})` — used by the floating Ask
    Genie button; `mode: 'lineage'`.
  - `buildTransferContext({view, batch}, node, side)` — used by the
    advanced lineage graph's right-click handler; `mode: 'lineage_transfer'`
    with the selected node identity + flow_qty (when present).
- `GenieDrawer.tsx` — right-side drawer with floating trigger button.
  Inline-styled following trace2's existing UI convention (no shared
  CSS dependency).  Backdrop / Escape / close-button dismiss paths.

### Wiring

- `App.tsx` mounts `<GenieDrawer>` at the shell level so deep
  components can dispatch via shared state.  `viewForPage()` maps the
  current page id to the Genie `view` field.
- `scripts/tests/test_ddd_architecture_guardrails.py` updated:
  - `trace2.genie_assist` added to `ALLOWED_CONTEXTS`.
  - `trace2_backend/genie_assist/application/genie_client.py` added to
    `APPLICATION_TRANSPORT_EXCEPTIONS` (mirrors POH's exemption for the
    same SSRF / HTTPException-from-application-layer pattern).

## What is deliberately deferred

### One-line wire-up after PR #54 merges

PR #54 adds the advanced lineage graph (`AdvancedLineageGraph`) with an
`onExplainNode?: (LineageNodeContext) => void` prop.  Once that PR lands,
both trace2 pages get a single-line update wiring the right-click menu
into the Genie drawer via `buildExplainTransferPrompt` +
`buildExplainTransferContext` (helpers that already exist in
`libs/shared-reporting` from PR #54).

### `flow_qty` on the page context

`flow_qty` is a `LineageNode` field that lives on PR #54.  Until #54
lands, `buildTransferContext` reads it via a defensive cast — when #54
merges, the cast can be dropped (the field is then part of the
published type).  Tracked inline in `pageContext.ts`.

### Genie-client consolidation across apps

The trace2 `genie_client.py` is ~95% identical to POH's and SPC's.  The
right structural answer is to extract the wire-protocol bits (host
allowlist, request_json, normalisation) into a `libs/shared-api/genie.py`
helper and keep only `compose_genie_content` per-app.  Out of scope for
Phase 3b because it would migrate two working apps simultaneously; once
SPC and POH have a third use case (e.g. envmon Genie), the shared
extraction is worth the migration risk.

## Deploy-time configuration

| Variable | Required | Notes |
|---|---|---|
| `TRACE2_GENIE_SPACE_ID` | Yes (or `GENIE_SPACE_ID`) | The trace2-specific Genie Space; falls back to `GENIE_SPACE_ID` for single-space workspaces |
| `DATABRICKS_HOST` | Yes | Workspace URL.  Must match the host allowlist (default: `*.azuredatabricks.net`, `*.cloud.databricks.com`, `*.gcp.databricks.com`) |
| `DATABRICKS_TOKEN` | Local-dev only | The Databricks Apps proxy injects `x-forwarded-access-token` in production |
| `GENIE_HOST_ALLOWLIST` | Optional | Comma-separated suffixes; overrides the default for non-default workspace domains |

## Tests

| File | Tests | What it covers |
|---|---|---|
| `apps/trace2/backend/tests/test_genie_client.py` | 14 | compose_genie_content (focal, transfer, empty, zero flow_qty), space_id resolution chain + missing, host allowlist (accept/reject/normalise/empty), normalize_message + normalize_query_result |
| `apps/trace2/frontend/src/genie/__tests__/pageContext.test.ts` | 7 | FocalNode passthrough, Batch flattening, fallback to material_id/plant_id, transfer context fields, flow_qty optional/finite/NaN |
| `apps/trace2/frontend/src/genie/__tests__/GenieDrawer.test.tsx` | 7 | Trigger render, drawer open render, onOpen dispatch, backdrop close, Send disabled-until-content, mode-label toggle, initialPrompt prefill |

Total: **28 new tests, all passing**.

The DDD architecture guardrails (6 tests) also still pass with the
trace2 genie_assist context registered.
