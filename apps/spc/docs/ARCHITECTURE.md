# SPC App Architecture

The Statistical Process Control (SPC) application delivers real-time charting, capability analysis, batch traceability, and audit-grade configuration management for manufacturing quality teams.

## Bounded Contexts

The backend is organised into two bounded contexts that reflect the domain's write/read asymmetry: most of SPC is read-only queries against gold-layer views and materialised views; the only transactional surface is the three app-managed tables.

### `process_control` — Read Context

Owns all queries against gold-layer and materialised-view data. Pure reads — no writes to gold tables ever.

```
backend/process_control/
├── dal/
│   ├── charts.py    # chart data pagination, control limits, normality, spec drift, data quality
│   ├── analysis.py  # scorecard, compare-scorecard, process flow, MSA session save, correlation, multivariate
│   └── metadata.py  # plants, materials, characteristics, attribute characteristics, validate-material
├── domain/
│   ├── control_charts.py  # mean, stddev, moving_range, compute_imr_limits, detect_nelson_rules, D2_TABLE
│   ├── capability.py      # compute_capability_indices, compute_non_parametric_capability, infer_spec_type,
│   │                      # compute_normality_result, normal_cdf, cpk_ci, CPK_* thresholds
│   ├── msa.py             # compute_grr (Average & Range), compute_grr_anova (crossed ANOVA)
│   └── multivariate.py    # compute_hotelling_t2 (Hotelling T² using numpy/pandas/scipy)
├── router_charts.py    # /chart-data, /data-quality, /control-limits, /p-chart-data, /count-chart-data
├── router_analysis.py  # /process-flow, /scorecard, /compare-scorecard, /msa/save, /msa/calculate,
│                       # /correlation, /correlation-scatter, /multivariate
└── router_metadata.py  # /plants, /validate-material, /materials, /characteristics, /attribute-characteristics
```

**Endpoints served:**
- `POST /api/spc/chart-data` — paginated observation points for I-MR / X-bar / attribute charts
- `POST /api/spc/data-quality` — observation quality summary (missing, outliers, gaps)
- `POST /api/spc/control-limits` — computed control limits for a cohort
- `POST /api/spc/p-chart-data` — proportion-defective chart data
- `POST /api/spc/count-chart-data` — defect-count chart data (C / U charts)
- `POST /api/spc/process-flow` — material lineage DAG with health indicators
- `POST /api/spc/scorecard` — quality scorecard for all MICs of a material
- `POST /api/spc/compare-scorecard` — cross-material scorecard comparison
- `POST /api/spc/msa/save` — persist a Gauge R&R session result
- `POST /api/spc/msa/calculate` — compute Gauge R&R (Average & Range or ANOVA)
- `POST /api/spc/correlation` — pairwise Pearson correlation matrix
- `POST /api/spc/correlation-scatter` — scatter plot data for a MIC pair
- `POST /api/spc/multivariate` — Hotelling T² multivariate chart
- `GET /api/spc/plants` — plants with data for a material
- `POST /api/spc/validate-material` — material existence check + display name
- `GET /api/spc/materials` — full material list
- `POST /api/spc/characteristics` — quantitative and attribute MICs for a material
- `POST /api/spc/attribute-characteristics` — attribute-only MICs

### `chart_config` — Write Context

Owns the three app-managed tables. All writes flow through domain value objects that enforce invariants before any SQL executes.

```
backend/chart_config/
├── dal/
│   ├── locked_limits.py  # spc_locked_limits reads + save + delete
│   └── exclusions.py     # spc_exclusions snapshot save + latest-fetch
├── domain/
│   ├── locked_limits.py  # LockedLimits value object (validates chart type, UCL > LCL)
│   └── exclusion.py      # Exclusion value object (validates chart type, stratify_by, justification length)
└── router.py             # /lock-limits, /locked-limits (GET + DELETE), /exclusions (POST + GET)
```

**Endpoints served:**
- `POST /api/spc/lock-limits` — persist or update locked control limits
- `GET /api/spc/locked-limits` — fetch most recent locked limits for a chart scope
- `DELETE /api/spc/locked-limits` — remove locked limits for a chart scope
- `POST /api/spc/exclusions` — persist an immutable exclusion audit snapshot
- `GET /api/spc/exclusions` — fetch most recent exclusion snapshot for a chart scope

## Domain Logic

All domain functions in `process_control/domain/` are pure functions with zero DB or framework dependencies — they can be unit-tested without mocks.

### Control Charts (`domain/control_charts.py`)

- `compute_imr_limits(values)` — Individual-Moving Range control limits (CL ± 3σ, D2 unbiasing)
- `detect_nelson_rules(values, cl, ucl, lcl)` — Returns violation indices for all 8 Nelson rules
- `D2_TABLE` — Hartley's d₂ constants for subgroup sizes 2–25

### Capability Indices (`domain/capability.py`)

- `compute_capability_indices(values, lsl, usl, target, sigma_within)` — Cp, Cpk, Pp, Ppk, Cpm, Z-score
- `compute_non_parametric_capability(values, lsl, usl)` — percentile-based capability for non-normal data
- `infer_spec_type(usl, lsl, target)` — classifies as `bilateral_symmetric`, `bilateral_asymmetric`, `unilateral_upper`, `unilateral_lower`, or `unspecified`
- `compute_normality_result(values)` — Shapiro-Wilk / K-S test with sample-size guard

Capability thresholds: `CPK_HIGHLY_CAPABLE=1.67`, `CPK_CAPABLE=1.33`, `CPK_MARGINAL=1.00`

### MSA (`domain/msa.py`)

- `compute_grr(measurement_data, tolerance)` — Average & Range Gauge R&R
- `compute_grr_anova(measurement_data, tolerance)` — Crossed ANOVA Gauge R&R

### Multivariate (`domain/multivariate.py`)

- `compute_hotelling_t2(rows, mic_ids, alpha)` — Hotelling T² chart using numpy/pandas/scipy; returns UCL, scores, anomaly ranking, and pairwise correlation metadata

## Domain Value Objects

Value objects in `chart_config/domain/` validate business invariants at construction time, raising `ValueError` before any SQL executes:

### `LockedLimits`

- `material_id` and `mic_id` must be non-empty
- `chart_type` must be one of: `imr`, `xbar_r`, `xbar_s`, `ewma`, `cusum`, `p_chart`, `np_chart`, `c_chart`, `u_chart`
- For `p_chart` (LCL clamped at 0): `ucl >= lcl`
- For all other types: `ucl > lcl` (strict)

### `Exclusion`

- `material_id` and `mic_id` must be non-empty
- `chart_type` must be one of: `imr`, `xbar_r`, `p_chart`
- `stratify_by`, when provided, must be one of: `plant_id`, `inspection_lot_id`, `operation_id`
- `justification` must be at least 3 characters after stripping

## Key Conventions

- **Auth:** `require_proxy_user` on all endpoints — extracts the Databricks OAuth token from the `x-forwarded-access-token` header set by the Databricks Apps proxy
- **SQL parameters:** `:param_name` style, passed as `[{"name": ..., "value": ...}]` via `sql_param()` helper — never string-interpolated
- **Table references:** `tbl("table_name")` resolves `{{CATALOG}}.{{SCHEMA}}.table_name` at runtime
- **Pagination:** cursor-based keyset pagination on `/chart-data` via `encode_chart_cursor` / `decode_chart_cursor`
- **Data freshness:** `attach_data_freshness()` appends last-modified timestamps from materialized view metadata to every read response
- **Rate limiting:** SlowAPI limiter with per-endpoint budgets; write endpoints are tighter (30/min) than read endpoints (60–120/min)

## Infrastructure (unchanged)

```
backend/
├── utils/
│   ├── db.py              # run_sql_async, run_sql, sql_param, tbl, check_warehouse_config,
│   │                      # insert_spc_exclusion_snapshot, detect_optional_columns, attach_data_freshness
│   ├── rate_limit.py      # SlowAPI limiter instance
│   ├── schema_contract.py # gold view schema drift detection (assert_gold_view_schema)
│   └── security.py        # same-origin middleware
├── routers/
│   ├── trace.py           # /api/trace, /api/summary — batch traceability (unchanged)
│   ├── export.py          # /api/spc/export — Excel/CSV download
│   └── genie.py           # /api/spc/genie — natural language queries
├── dal/
│   └── trace_dal.py       # trace-specific SQL (unchanged)
├── schemas/
│   ├── spc_schemas.py     # Pydantic request/response models
│   └── trace_schemas.py   # Trace Pydantic models
└── main.py                # FastAPI app, router registration, /api/health, /api/ready
```
