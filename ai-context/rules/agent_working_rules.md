# Agent Working Rules

> This is your operating contract. Read this BEFORE writing any code.
> These rules apply regardless of which AI agent you are (Claude, Gemini, Codex, Genie, etc.).

## Rule 0: Offline-First Principle

You may or may not have live access to a Databricks workspace. **All rules below
apply regardless of connectivity.**  Your primary source of truth is the files in
this `ai-context/` directory, not live schema introspection.

---

## 1. Data Layer Rules

### 1.1 Only Use Approved Entities
- You MUST only query tables and views listed in `semantic-model/entities.yaml`
- You MUST NOT invent table names, even if they seem logical
- You MUST NOT query bronze or silver layer tables under any circumstances
- If you need a table that is not listed, **stop and ask the human**

### 1.2 Only Use Approved Joins
- You MUST only use join paths defined in `semantic-model/joins.yaml`
- You MUST NOT invent join conditions between entities
- You MUST respect the declared cardinality and join type (LEFT JOIN, etc.)
- You MUST include any `filter_on_join` conditions (e.g., `LANGUAGE_ID = 'E'`)

### 1.3 Only Use Approved Metrics
- You MUST use metric formulas from `semantic-model/metrics.yaml`
- You MUST NOT invent KPI calculations — even common ones like "yield"
- If a metric is not defined, **stop and ask the human**

### 1.4 Use Canonical SQL Patterns
- For common operations (traceability, mass balance, etc.), use the patterns in
  `examples/canonical_sql.sql`
- You MUST use `WITH RECURSIVE` for any self-referencing CTE
- You MUST include cycle detection in recursive trace queries
- You MUST pre-aggregate before joining stock or delivery data to lineage

### 1.5 Respect Code Lookups
- Use `semantic-model/enums.yaml` for SAP movement types, result valuations, etc.
- NEVER hardcode a movement type without checking the enum first
- Use MOVEMENT_CATEGORY for business-level filtering, MOVEMENT_TYPE for detail

---

## 2. Naming and Reference Rules

### 2.1 Catalog References
- Use `{{CATALOG}}` placeholder in SQL templates (resolved at deploy time)
- In DAL code, use the `tbl('table_name')` helper function
- NEVER hardcode a catalog name in application code

### 2.2 Column Name Fidelity
- Use EXACT column names from `entities.yaml` — case-sensitive
- NEVER rename columns in SQL unless the entities.yaml documents the alias
- When a view and a materialized view exist for the same data, their column
  names MUST match — check entities.yaml to confirm

### 2.3 Parameter Style
- Backend SQL: use `:param_name` named parameters (Databricks SQL Statement API)
- NEVER use string interpolation or f-strings for user-supplied values
- The only exception is the `tbl()` function for table name resolution

---

## 3. Data Quality Rules

### 3.1 NULL Handling
- Assume ANY column can be NULL unless entities.yaml says otherwise
- Always use COALESCE for numeric aggregations: `COALESCE(SUM(col), 0)`
- Always use COALESCE for display strings: `COALESCE(name, id, '(unknown)')`

### 3.2 Deduplication
- `gold_batch_delivery_v`: Always `SELECT DISTINCT` before `SUM(ABS_QUANTITY)`
- `gold_batch_lineage`: Always `SELECT DISTINCT` edges before recursive traversal
- When in doubt, check the entity's `traps` section in entities.yaml

### 3.3 Type Safety
- MATERIAL_ID, BATCH_ID, PLANT_ID are STRINGS — never cast to INT
- TOLERANCE in quality results is STRING — use `TRY_CAST(TOLERANCE AS DOUBLE)`
- All SQL Statement API results arrive as strings — frontend must parse

---

## 4. Security Rules

### 4.1 No Credentials in Code
- NEVER hardcode tokens, passwords, or connection strings
- Use environment variables for all configuration
- Use `resolve_token()` for user authentication in backend code

### 4.2 No PII in Context Files
- These ai-context files MUST NOT contain real customer names, batch IDs, or user data
- Examples use anonymised or synthetic data only
- Sample material IDs and batch IDs in examples are from non-production environments

### 4.3 Parameterised Queries Only
- All user-supplied values MUST go through `sql_param()` / named parameters
- The `tbl()` function is the ONLY place where dynamic SQL is acceptable

---

## 5. Offline vs On-Network Behaviour

### 5.1 When Offline (No Databricks Access)
- Use ONLY the files in this `ai-context/` directory as your data model
- Generate code that is structurally correct based on entities.yaml
- Flag any assumptions with a `-- TODO: validate against live schema` comment
- Use sample data from `samples/` for testing if available

### 5.2 When On-Network (Live Databricks Access)
- You MAY validate your SQL against the live warehouse
- You MAY use `DESCRIBE TABLE` to confirm column names
- You MUST still follow all rules above — live access does not override the semantic model
- If live schema disagrees with entities.yaml, **flag the discrepancy to the human**
  rather than silently using the live schema

---

## 6. Communication Rules

### 6.1 When You Are Uncertain
- If a question maps to "Questions That Require Clarification" in common_questions.md, ASK
- If you need a table not in entities.yaml, ASK
- If you need a metric not in metrics.yaml, ASK
- NEVER guess and NEVER use tribal knowledge

### 6.2 When You Make Assumptions
- Document every assumption as a code comment
- If you use a column not in entities.yaml, add `-- ASSUMPTION: column X exists`
- If you invent a join, add `-- ASSUMPTION: join not in joins.yaml — validate`

### 6.3 When You Find an Error
- If entities.yaml seems wrong based on live data, tell the human
- If a canonical SQL pattern fails, tell the human with the error message
- Suggest the fix AND suggest updating the relevant ai-context file
