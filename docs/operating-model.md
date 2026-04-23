# Operating Model

> How to use the Agent Enablement Pack across offline and on-network modes.

---

## 1. Executive Summary

This pack provides a portable semantic knowledge layer that enables any AI coding
agent to write correct Databricks app code without requiring live database access.

**Key insight**: Most agent errors come from missing context, not missing capability.
An agent that has accurate table schemas, approved join paths, metric definitions,
and canonical SQL patterns will write correct code. An agent with only live schema
introspection will frequently produce code that is structurally valid but
semantically wrong (wrong joins, wrong aggregation, wrong metric formulas).

This pack solves that by encoding the **business semantics** — not just the schema —
into version-controlled files that travel with the code.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGENT (any vendor)                       │
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │ Claude/Gemini │    │   Codex      │    │ Genie Code   │     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│          │                   │                   │              │
│          └───────────┬───────┴───────────────────┘              │
│                      │                                          │
│              ┌───────▼────────┐                                 │
│              │  ai-context/   │  ← ALWAYS available (Git)       │
│              │  (this pack)   │                                 │
│              └───────┬────────┘                                 │
│                      │                                          │
│         ┌────────────┼────────────┐                             │
│         │            │            │                              │
│    ┌────▼────┐  ┌────▼────┐  ┌───▼────┐                        │
│    │semantic │  │  rules  │  │examples│                         │
│    │ model   │  │         │  │        │                         │
│    └─────────┘  └─────────┘  └────────┘                         │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  OPTIONAL: Live Access  │  ← Only when on corporate network
              │                         │
              │  • SQL Statement API    │
              │  • MCP (future)         │
              │  • DESCRIBE TABLE       │
              └─────────────────────────┘
```

### Information Flow

1. **Always available**: `ai-context/` files in Git → agent reads them
2. **Sometimes available**: Live Databricks SQL warehouse → agent validates
3. **Never required**: Live access is never a prerequisite for code generation

---

## 3. Offline Mode Operating Model

### When Does Offline Mode Apply?

- Developer is NOT on the corporate network (home, travel, etc.)
- No VPN connection to Databricks workspace
- No MCP server running
- Agent only has access to local Git repository files

### What the Agent CAN Do Offline

| Activity | Source |
|---|---|
| Write backend DAL functions | entities.yaml, joins.yaml, canonical_sql.sql |
| Write frontend components | api_payload_examples.json, frontend_rules.md |
| Write API route handlers | backend_rules.md, api_payload_examples.json |
| Calculate metrics | metrics.yaml |
| Translate SAP codes | enums.yaml, sap_code_meanings.md |
| Answer business questions | common_questions.md, business_terms.md |
| Generate SQL queries | canonical_sql.sql, entities.yaml, joins.yaml |
| Build test data | samples/ |

### What the Agent CANNOT Do Offline

| Activity | Reason | Mitigation |
|---|---|---|
| Validate SQL execution | No warehouse | Add `-- TODO: validate` comments |
| Confirm column existence | No DESCRIBE TABLE | Trust entities.yaml, flag assumptions |
| Check row counts | No data access | Use sample data from samples/ |
| Verify permissions | No UC access | Document required grants |
| Run integration tests | No backend | Unit test with mocked responses |

### Offline Behaviour Contract

When offline, the agent MUST:

1. Treat `ai-context/` files as the single source of truth
2. Use ONLY entities, joins, metrics, and patterns defined in these files
3. Flag every assumption with a clear comment
4. Never silently guess at table names, column names, or join logic
5. Generate code that is structurally correct and ready for on-network validation

---

## 4. On-Network Mode Operating Model

### When Does On-Network Mode Apply?

- Developer is on the corporate network (office or VPN)
- Databricks workspace is accessible
- SQL warehouse is running
- Optionally: MCP server is available

### What the Agent GAINS On-Network

| Capability | Method |
|---|---|
| Validate SQL queries | Execute against SQL warehouse |
| Confirm column names | `DESCRIBE TABLE catalog.schema.table` |
| Check data freshness | `system.information_schema.tables` |
| Run integration tests | Hit live `/api/health` and `/api/ready` |
| Generate fresh samples | `SELECT ... LIMIT N` and save to samples/ |
| Validate row counts | `SELECT COUNT(*)` on source views |

### On-Network Behaviour Contract

When on-network, the agent MUST:

1. **Still follow all offline rules** — live access does NOT override the semantic model
2. Use live access for VALIDATION, not as the primary source of truth
3. If live schema disagrees with entities.yaml, flag to the human (do not silently adapt)
4. Update ai-context files if the human confirms a schema change
5. Refresh samples/ directory with fresh extracts when appropriate

---

## 5. Optional Live Validation Design

### 5.1 Databricks SQL Statement Execution API

The primary validation mechanism. Used by the backend at runtime and available
for agent validation when on-network.

```python
# Validate a query without executing against production data
# Use EXPLAIN to check syntax and table references
EXPLAIN SELECT * FROM connected_plant_uat.gold.gold_batch_stock_v LIMIT 1

# Validate column existence
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_stock_v

# Check freshness
SELECT table_name, last_altered
FROM system.information_schema.tables
WHERE table_catalog = 'connected_plant_uat' AND table_schema = 'gold'
```

### 5.2 Optional MCP Integration

When an MCP server is available (corporate network only):

- Agents can use MCP tools for live schema introspection
- MCP provides structured access to Unity Catalog metadata
- MCP is a convenience layer, NOT a requirement
- All MCP-derived information should be cross-checked against entities.yaml

**MCP integration points** (future):
- `mcp://databricks/describe-table` → validate column names
- `mcp://databricks/execute-sql` → run validation queries
- `mcp://databricks/list-tables` → discover new tables for entities.yaml

### 5.3 Backend Proxy Validation

The app's own backend can serve as a validation proxy:

```
GET /api/health     → backend is running
GET /api/ready      → SQL warehouse is reachable
GET /api/health/debug → (dev mode) shows config, catalog, schema
```

### 5.4 Validation Script

`ai-context/validation/validate.py` provides automated validation:

```bash
# Run when on-network to validate entities.yaml against live schema
python ai-context/validation/validate.py --catalog connected_plant_uat --schema gold
```

This script:
1. Reads entities.yaml
2. Runs DESCRIBE TABLE for each entity
3. Compares declared columns vs actual columns
4. Reports mismatches (missing columns, type differences, extra columns)
5. Outputs a validation report

---

## 6. Governance and Maintenance Model

### 6.1 Who Maintains What

| File | Owner | Update Trigger |
|---|---|---|
| entities.yaml | Data Engineer | Gold view schema change |
| joins.yaml | Data Engineer | New join path needed |
| metrics.yaml | Analytics Engineer | New KPI defined |
| enums.yaml | Data Engineer | New SAP movement type |
| business_terms.md | Domain Expert / PO | New concept introduced |
| sap_code_meanings.md | SAP Consultant | New integration |
| canonical_sql.sql | Backend Developer | New query pattern |
| common_questions.md | Product Owner | New user story |
| api_payload_examples.json | Backend Developer | API response change |
| agent_working_rules.md | Tech Lead | Architecture decision |
| frontend_rules.md | Frontend Developer | Convention change |
| backend_rules.md | Backend Developer | Convention change |

### 6.2 Change Process

1. **Schema change** → update entities.yaml in the SAME PR as the DDL change
2. **New metric** → add to metrics.yaml, add canonical SQL if complex
3. **New entity** → add to entities.yaml AND joins.yaml (for join paths)
4. **Bug found via agent** → add to the entity's `traps` list in entities.yaml
5. **New app** → fork this pack, adapt entities/rules, keep structure

### 6.3 Review Checklist

Before merging any PR that touches `ai-context/`:

- [ ] entities.yaml column names match actual gold view columns
- [ ] joins.yaml join conditions are correct and tested
- [ ] metrics.yaml formulas produce correct results for known data
- [ ] enums.yaml codes match SAP documentation
- [ ] canonical_sql.sql patterns execute without error
- [ ] api_payload_examples.json matches actual API output shape
- [ ] No PII, credentials, or real customer data in any file

---

## 7. Keeping the Pack Agent-Neutral

### Why This Matters

Different agents have different capabilities and context window sizes.
This pack must work with all of them.

### Design Rules for Neutrality

| Rule | Rationale |
|---|---|
| Plain text formats only (YAML, MD, JSON, SQL) | Every agent can read these |
| No proprietary annotations | No Claude XML, no Gemini tags, no Codex markers |
| Self-contained files | No external references that require specific tooling |
| Flat file structure | No deep nesting that confuses context loading |
| Explicit over implicit | State everything — assume no prior knowledge |
| Human-readable AND machine-readable | Files serve both audiences |

### How to Point Each Agent at the Pack

| Agent | Method |
|---|---|
| **Claude** (API/chat) | Include files in system prompt or upload as project files |
| **Claude Code** | Place in repo root; `.claude/` rules reference ai-context/ |
| **Gemini** | Upload files or reference in context window |
| **Codex** (OpenAI) | Include in repository; reference in AGENTS.md |
| **Databricks Genie** | Reference via assistant instructions or skill files |
| **Cursor / Copilot** | Include in `.cursorrules` or `.github/copilot-instructions.md` |

### Agent-Specific Config Files (Optional)

If you need agent-specific instructions, create them OUTSIDE ai-context/:

```
.claude/                  ← Claude Code project config
.cursorrules              ← Cursor rules
.github/copilot-instructions.md  ← Copilot
AGENTS.md                 ← OpenAI Codex
```

Each of these should point to `ai-context/` as the primary source:

```
# .cursorrules (example)
Read ai-context/rules/agent_working_rules.md before any task.
Use ai-context/semantic-model/ for all data model questions.
```

---

## 8. Risks and Limitations

### 8.1 Stale Semantic Model
**Risk**: entities.yaml drifts from actual gold view schemas.
**Impact**: Agents generate code with wrong column names → runtime errors.
**Mitigation**: Run validation script on every deploy. Include entities.yaml
update in schema change PRs. Treat drift as a bug.

### 8.2 Incomplete Coverage
**Risk**: New tables or metrics are added but not reflected in the pack.
**Impact**: Agents either can't help or hallucinate structures.
**Mitigation**: Gate new feature work on semantic model updates. Add to PR checklist.

### 8.3 Agent Ignoring Rules
**Risk**: Agent reads the rules but generates non-compliant code anyway.
**Impact**: Wrong joins, wrong metrics, security violations.
**Mitigation**: Code review against ai-context files. Automated linting for
sql_param() usage and tbl() usage. Test canonical patterns.

### 8.4 Context Window Limits
**Risk**: Agent can't load all ai-context files at once.
**Impact**: Agent misses critical rules or entity definitions.
**Mitigation**: Prioritise loading order (rules → entities → joins → metrics).
Keep files focused and avoid bloat. Use agent_working_rules.md as the mandatory
minimum load.

### 8.5 Cross-App Divergence
**Risk**: Multiple apps fork the pack and diverge in incompatible ways.
**Impact**: Shared entities defined differently across apps.
**Mitigation**: Keep a canonical "core" pack with shared entities. App-specific
extensions go in separate overlay files.

### 8.6 No Runtime Enforcement
**Risk**: The pack is advisory — nothing prevents an agent from ignoring it.
**Impact**: All the documentation effort is wasted.
**Mitigation**: Consider build-time validation (linter that checks SQL against
entities.yaml). Human code review remains the final gate.

---

## 9. Adapting This Pack Per Application

### Step 1: Fork the Pack
Copy this entire directory into your new app's repository.

### Step 2: Update Entities
- Remove entities not used by your app
- Add app-specific entities (e.g., SPC views for the SPC app)
- Add `app_scope` tags to entity definitions

### Step 3: Update Rules
- Adjust frontend_rules.md for your tech stack (if different)
- Adjust backend_rules.md for your API patterns
- Keep agent_working_rules.md as-is (core contract)

### Step 4: Update Examples
- Replace api_payload_examples.json with your app's actual API shapes
- Add app-specific canonical SQL patterns
- Update common_questions.md for your app's domain

### Step 5: Validate
Run the validation script against your app's target catalog/schema.

### Step 6: Point Your Agents
Update agent config files to reference the pack.

---

## 10. Recommended Next Steps

1. **Immediate**: Review entities.yaml against live schema — run validation script
2. **This sprint**: Add sample CSV extracts to samples/ for offline testing
3. **Next sprint**: Set up CI job to validate entities.yaml on every merge to main
4. **Future**: Build MCP adapter for live validation from Claude/Cursor
5. **Future**: Create a shared "core" pack for entities used across multiple apps
