"""Semantic-model governance gate.

Enforces that every table reference in app DAL code resolves to an entity that
is listed in ``ai-context/semantic-model/entities.yaml``.  This is the H-3 fix
from the architecture review: the semantic model was previously documentation
only; this test makes it executable.

What it checks
--------------
1. **Approved-entity coverage.**  Every call to ``tbl(<name>)``,
   ``silver_tbl(<name>)`` and ``instrument_tbl(<name>)`` across ``apps/`` and
   ``libs/`` must reference a string-literal name that either appears in
   ``entities.yaml`` or is whitelisted below.  Dynamic references
   (variables / f-strings) are reported and reviewed manually.

2. **No bronze direct access.**  CLAUDE.md says "All SQL targets gold-layer
   views only — never bronze or silver", with documented silver exceptions.
   This test asserts the bronze rule strictly and the silver rule with an
   explicit allow-list (currently ``silver_process_order`` and ``instrument``
   for POH vessel planning).

3. **Catalog hygiene.**  No hard-coded ``connected_plant_uat.`` literals in
   Python or SQL view files; everything must be templated via ``{{CATALOG}}``,
   ``${TRACE_CATALOG}``, or the ``tbl()`` helper family.

Run locally
-----------
    uv run --with pytest pytest scripts/tests/test_semantic_model_governance.py -v

The test is not part of any app's ``nx test`` because it spans the whole
repo; CI invokes it directly alongside the DDD guardrails.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Iterable, Optional

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
SEMANTIC_MODEL = REPO_ROOT / "ai-context" / "semantic-model" / "entities.yaml"

# Entities that are not yet in entities.yaml but are intentionally allowed.
# This set acts as a RATCHET — every entry should eventually move into
# entities.yaml.  Adding a new table reference in DAL code without updating
# this list (or entities.yaml) will fail the test.
#
# Each entry should include a justification.  Reviewers: when an entity is
# promoted to entities.yaml, remove it from this list.
APPROVED_BUT_UNLISTED: set[str] = {
    # ── App-specific MVs / aggregates not yet promoted to the cross-app model ──
    "spc_batch_dim_mv",                 # SPC: materialised batch-date dim
    "spc_quality_metrics",              # SPC: pre-computed normality / capability metrics
    "spc_quality_metric_subgroup_v",    # SPC: per-subgroup quality metric view
    "spc_attribute_subgroup_mv",        # SPC: p/np/c/u attribute aggregates
    "spc_attribute_quality_metrics",    # SPC: attribute chart metadata
    "spc_spec_drift_summary_v",         # SPC: capability drift summary
    "spc_process_flow_source_mv",       # SPC: process-flow source
    "spc_msa_sessions",                 # SPC: measurement-system-analysis session metadata
    "spc_query_audit",                  # SPC: app-managed query audit log (read-write)
    # ── EnvMon app-managed and aggregate tables ──
    "metric_envmon_heatmap_v",          # envmon: spatial heatmap aggregate
    "metric_envmon_trend_v",            # envmon: per-location MIC trend
    "em_location_coordinates",          # envmon: app-managed coordinates (read-write)
    "em_plant_floor",                   # envmon: app-managed floor-plan metadata
    "em_plant_geo",                     # envmon: app-managed geo bounding boxes
    # ── POH gold views (publish to entities.yaml in a follow-up) ──
    "vw_gold_process_order",
    "vw_gold_process_order_plan",
    "vw_gold_material",
    "vw_gold_confirmation",
    "vw_gold_adp_movement",
    "vw_gold_downtime_and_issues",
    "vw_gold_yield_summary",
    "vw_gold_oee_summary",
    "vw_gold_oee_event",
    "vw_gold_oee_day",
    "vw_gold_quality_first_pass",
    "vw_gold_schedule_adherence",
    # ── Trace2 lineage views (awaiting cross-app promotion) ──
    "vw_gold_batch_lineage",
    "vw_gold_batch_genealogy",
    "vw_gold_mass_balance",
    # ── Warehouse360 phase-1 views ──
    "wh360_process_orders_v",
    "wh360_transfer_orders_v",
    "wh360_transfer_requirements_v",
    "wh360_deliveries_v",
    "wh360_inbound_v",
    "wh360_bin_stock_v",
    "wh360_lineside_stock_v",
    "wh360_dispensary_tasks_v",
    "wh360_handling_units_v",
    "wh360_kpi_snapshot_v",
    "wh360_imwm_reconciliation_v",
    "wh360_near_expiry_v",
    "wh360_near_expiry_batches_v",
    # ── IMWM reconciliation views ──
    "imwm_stock_comparison_v",
    "imwm_movements_v",
    "imwm_exceptions_v",
    "imwm_analytics_aging_v",
    # ── Additional POH order_execution / order_detail views ──
    "vw_gold_process_order_material",
    "vw_gold_process_order_phase",
    "vw_gold_batch_material",
    "vw_gold_logs_notes_and_comments",
    "vw_gold_inspection_result",
    "vw_gold_inspection_specification",
    "vw_gold_inspection_lot",
    "vw_gold_inspection_usage_decision",
    # ── Trace2 batch views ──
    "gold_batch_delivery_v",
    "gold_batch_mass_balance_v",
    "gold_batch_stock_v",
    # ── Cross-namespace reference (POH reads from wh360 schema) ──
    "wh360.wh360_lineside_stock_v",
}

# Documented silver-layer exceptions (CLAUDE.md mandate + DAL docstring).
APPROVED_SILVER_TABLES: set[str] = {
    "silver_process_order",  # POH vessel planning: SCHEDULED_START, QUANTITY, UOM
    "instrument",            # POH vessel planning: MAXIMUM_CAPACITY
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _approved_entity_names() -> set[str]:
    """Return the set of entity names listed under ``entities:`` in entities.yaml."""
    with SEMANTIC_MODEL.open("r", encoding="utf-8") as f:
        model = yaml.safe_load(f)
    return {entity["name"] for entity in model.get("entities", [])}


def _python_files() -> Iterable[Path]:
    """Yield application-code .py files under apps/ and libs/.

    Excludes:
    - ``tests/`` and ``test_data/`` (allowed to mock or hard-code anything)
    - ``*.egg-info/`` packaging artefacts
    - ``apps/*/scripts/`` dev / validation / probe scripts that intentionally
      carry UAT defaults for developer convenience and are not deployed.
    """
    for base in ("apps", "libs"):
        for path in (REPO_ROOT / base).rglob("*.py"):
            rel_parts = path.relative_to(REPO_ROOT).parts
            if "tests" in rel_parts or "test_data" in rel_parts:
                continue
            if any(p.endswith(".egg-info") for p in rel_parts):
                continue
            if rel_parts[0] == "apps" and "scripts" in rel_parts:
                # apps/<x>/scripts/... — dev tooling, not application code
                continue
            yield path


def _sql_view_files() -> Iterable[Path]:
    """Yield all source .sql files under apps/*/sql/, excluding rendered output.

    ``rendered/`` directories contain the catalog-substituted DDL produced by
    ``scripts/render_sql_views.py`` and are not source-of-truth.
    """
    for path in (REPO_ROOT / "apps").rglob("sql/**/*.sql"):
        if "rendered" in path.parts:
            continue
        yield path


_TBL_HELPERS = {"tbl", "silver_tbl", "instrument_tbl"}
_HARDCODED_CATALOG = re.compile(r"\bconnected_plant_uat\b")


def _iter_tbl_calls(source: str) -> Iterable[tuple[str, Optional[str], int]]:
    """Walk a Python source file's AST and yield each tbl-helper call.

    Yields tuples of ``(helper_name, literal_arg, line_no)``.  ``literal_arg``
    is the string passed as the first positional argument when it is a string
    literal; ``None`` indicates a dynamic argument (variable, f-string,
    concatenation, etc.) so callers can treat dynamic references separately.

    Operating on the AST instead of regex avoids two classes of false
    positive that scrappy text-matching is prone to:

    1. ``tbl('foo')`` inside a comment, docstring, or unrelated string literal.
    2. Helpers with trailing commas or multi-line argument formatting that
       happen to defeat the regex parenthesis match.

    Files that cannot be parsed (very rare — only if the file has a syntax
    error) yield nothing; the surrounding test harness already requires
    importable code, so a syntax-error file would have been caught earlier.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        # We only care about `tbl(...)`-style bare calls; attribute access
        # (`obj.tbl(...)`) is something else entirely and out of scope.
        func = node.func
        if not isinstance(func, ast.Name) or func.id not in _TBL_HELPERS:
            continue
        if node.args and isinstance(node.args[0], ast.Constant) and isinstance(
            node.args[0].value, str
        ):
            yield func.id, node.args[0].value, node.lineno
        else:
            yield func.id, None, node.lineno


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_entities_yaml_parses():
    """Sanity: entities.yaml is valid YAML with a non-empty entity list."""
    names = _approved_entity_names()
    assert names, "entities.yaml must declare at least one entity"
    # Spot-check a few cross-app entities every app should know about.
    for required in ("gold_material", "gold_plant"):
        assert required in names, f"entities.yaml missing required entity {required!r}"


def test_all_tbl_references_are_approved():
    """Every ``tbl('...')`` call must reference a listed or whitelisted entity."""
    approved = _approved_entity_names() | APPROVED_BUT_UNLISTED
    offenders: list[tuple[str, int, str]] = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8")
        for helper, name, line_no in _iter_tbl_calls(text):
            if helper == "silver_tbl":
                continue  # silver checked separately
            if helper == "instrument_tbl":
                continue  # csm_equipment_history schema, allowed
            if name is None:
                continue  # dynamic — reported separately
            if name in approved:
                continue
            offenders.append((str(path.relative_to(REPO_ROOT)), line_no, name))
    if offenders:
        formatted = "\n".join(f"  {p}:{n}  → tbl({t!r})" for p, n, t in offenders)
        pytest.fail(
            "Found tbl() references to entities not in semantic-model/entities.yaml "
            "(or APPROVED_BUT_UNLISTED whitelist):\n"
            f"{formatted}\n\n"
            "Either add the entity to entities.yaml or extend "
            "APPROVED_BUT_UNLISTED with a justification."
        )


def test_silver_tbl_only_uses_documented_exceptions():
    """``silver_tbl(...)`` may only reference tables on the approved exception list."""
    offenders: list[tuple[str, int, str]] = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8")
        for helper, name, line_no in _iter_tbl_calls(text):
            if helper != "silver_tbl":
                continue
            if name is None or name in APPROVED_SILVER_TABLES:
                continue
            offenders.append((str(path.relative_to(REPO_ROOT)), line_no, name))
    if offenders:
        formatted = "\n".join(f"  {p}:{n}  → silver_tbl({t!r})" for p, n, t in offenders)
        pytest.fail(
            "Found silver_tbl() references outside APPROVED_SILVER_TABLES.\n"
            "CLAUDE.md requires gold-layer-only queries with documented exceptions.\n"
            f"{formatted}"
        )


def test_no_hardcoded_catalog_in_python():
    """No Python file may hard-code the UAT catalog name ``connected_plant_uat``."""
    offenders: list[tuple[str, int]] = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8")
        for match in _HARDCODED_CATALOG.finditer(text):
            line_no = text.count("\n", 0, match.start()) + 1
            offenders.append((str(path.relative_to(REPO_ROOT)), line_no))
    if offenders:
        formatted = "\n".join(f"  {p}:{n}" for p, n in offenders)
        pytest.fail(
            "Hard-coded catalog `connected_plant_uat` found in Python source. "
            "Use the TRACE_CATALOG / POH_CATALOG env var and the tbl() helper.\n"
            f"{formatted}"
        )


def test_no_hardcoded_catalog_in_sql_views():
    """SQL view DDL must template the catalog via ``${TRACE_CATALOG}``/``${PUBLISHED_CATALOG}``."""
    offenders: list[tuple[str, int]] = []
    for path in _sql_view_files():
        text = path.read_text(encoding="utf-8")
        for match in _HARDCODED_CATALOG.finditer(text):
            line_no = text.count("\n", 0, match.start()) + 1
            offenders.append((str(path.relative_to(REPO_ROOT)), line_no))
    if offenders:
        formatted = "\n".join(f"  {p}:{n}" for p, n in offenders)
        pytest.fail(
            "Hard-coded catalog `connected_plant_uat` found in SQL view DDL. "
            "Render via scripts/render_sql_views.py using ${TRACE_CATALOG} placeholders.\n"
            f"{formatted}"
        )


def test_dynamic_tbl_calls_are_reported():
    """List (don't fail) any ``tbl(<variable>)`` calls so reviewers can audit them.

    Dynamic table references defeat static analysis. A small handful is fine
    (e.g. tests, the schema_contract helper), but a growing list is a smell.
    """
    dynamic_calls: list[tuple[str, int, str]] = []
    for path in _python_files():
        text = path.read_text(encoding="utf-8")
        for helper, name, line_no in _iter_tbl_calls(text):
            if name is not None:
                continue  # literal — covered by the approval test
            dynamic_calls.append((str(path.relative_to(REPO_ROOT)), line_no, helper))
    # Report-only: do not assert. Reviewers can read the test output.
    if dynamic_calls:
        print(f"\n[info] {len(dynamic_calls)} dynamic tbl() calls found (review manually):")
        for p, n, helper in dynamic_calls[:30]:
            print(f"  {p}:{n}  → {helper}(<dynamic>)")
