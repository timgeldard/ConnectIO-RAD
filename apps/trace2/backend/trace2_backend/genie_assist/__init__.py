"""trace2 Genie Assist bounded context.

Mirrors the POH ``genie_assist/`` context shape — proxy + helpers for the
Databricks Genie Conversation API, scoped to a trace2-specific Genie
Space and prompt shape.  The transport client is intentionally a verbatim
copy of POH's; both will eventually consolidate into a shared
``libs/shared-api`` Genie helper (tracked in the Phase 3b commit
message).  Until then, the duplication keeps the per-app Genie Space
ownership decisions independent.
"""
