from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

logger = logging.getLogger(__name__)

TraceRow = Mapping[str, Any]
TraceKey = tuple[str, str]


def node_status_style(status: str) -> tuple[str, str]:
    if status == "Released":
        return "#10b981", "Pass"
    if status in {"Blocked", "Rejected", "Expired"}:
        return "#ef4444", "Critical"
    if status in {"QI Hold", "Restricted"}:
        return "#f59e0b", "Warning"
    return "#9ca3af", "Unknown"


def build_trace_tree(rows: list[TraceRow]) -> dict[str, Any] | None:
    if not rows:
        return None

    node_rows: dict[TraceKey, TraceRow] = {}
    edge_rows: list[TraceRow] = []
    for row in rows:
        key = (str(row["material_id"]), str(row["batch_id"]))
        if key not in node_rows or row.get("depth", 0) < node_rows[key].get("depth", 0):
            node_rows[key] = row
        edge_rows.append(row)

    def make_node(row: TraceRow) -> dict[str, Any]:
        status = str(row.get("release_status", "Unknown")).strip()
        color, tier = node_status_style(status)
        return {
            "name": str(row["material_id"]),
            "status": status,
            "riskTier": tier,
            "nodeColor": color,
            "attributes": {
                "Batch": str(row["batch_id"]),
                "Depth": row.get("depth", 0),
                "Plant": row.get("plant_name", "Unknown Plant"),
            },
            "children": [],
        }

    children_of: dict[TraceKey, list[TraceKey]] = {key: [] for key in node_rows}
    root_key: TraceKey | None = None

    for row in edge_rows:
        key = (str(row["material_id"]), str(row["batch_id"]))
        parent_material = row.get("parent_material_id")
        parent_batch = row.get("parent_batch_id")
        if parent_material is None or parent_batch is None:
            if root_key is None or row.get("depth", 0) < node_rows[root_key].get("depth", 0):
                root_key = key
        else:
            parent_key = (str(parent_material), str(parent_batch))
            if parent_key in node_rows and key in node_rows:
                siblings = children_of[parent_key]
                if key not in siblings:
                    siblings.append(key)

    def build_subtree(node_key: TraceKey, ancestors: set[TraceKey]) -> dict[str, Any]:
        node = make_node(node_rows[node_key])
        next_ancestors = set(ancestors)
        next_ancestors.add(node_key)
        for child_key in children_of.get(node_key, []):
            if child_key in next_ancestors:
                logger.warning(
                    "Cycle detected in build_trace_tree: %s -> %s already in ancestor path",
                    node_key,
                    child_key,
                )
                continue
            node["children"].append(build_subtree(child_key, next_ancestors))
        return node

    if root_key is None:
        return None
    return build_subtree(root_key, set())
