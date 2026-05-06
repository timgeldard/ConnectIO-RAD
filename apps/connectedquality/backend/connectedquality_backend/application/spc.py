"""Application adapters for ConnectedQuality SPC summaries."""

from spc_backend.process_control.dal.analysis import fetch_process_flow, fetch_scorecard

__all__ = ["fetch_process_flow", "fetch_scorecard"]
