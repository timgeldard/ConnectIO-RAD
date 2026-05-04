"""
Domain logic for building and styling trace trees.
Wraps core logic from shared_trace.
"""

from typing import Any
from shared_trace.tree import build_trace_tree as _build_trace_tree
from shared_trace.tree import node_status_style as _node_status_style

def build_trace_tree(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Build a recursive tree structure from a list of trace rows.
    """
    return _build_trace_tree(rows)

def node_status_style(status: str) -> tuple[str, str]:
    """
    Return color and risk tier for a given status.
    """
    return _node_status_style(status)
