"""Application adapters for cross-module alarm signals."""

from envmon_backend.inspection_analysis.dal.plants import fetch_active_plant_ids, fetch_plant_kpis
from spc_backend.process_control.dal.analysis import fetch_scorecard

__all__ = ["fetch_active_plant_ids", "fetch_plant_kpis", "fetch_scorecard"]
