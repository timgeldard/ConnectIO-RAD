"""Domain — risk score calculation using weighted exponential time decay."""

import math
from datetime import date

from backend.utils.em_config import MIC_DECAY_RATES


def calculate_risk_score(rows: list[dict], today: date, decay_lambda: float) -> float:
    """Compute weighted exponential-decay risk score for a location's result rows.

    Each failing result contributes weight * e^(-lambda * days_ago). Passing results
    contribute zero weight. MIC-specific lambdas from config override the default.
    """
    score = 0.0
    for r in rows:
        val = (r.get("valuation") or "").upper()
        mic_name = (r.get("mic_name") or "").upper().strip()
        created_str = r.get("lot_date")
        if not created_str:
            continue
        try:
            created = date.fromisoformat(str(created_str))
        except ValueError:
            continue
        dt = max((today - created).days, 0)
        weight = 10.0 if val in ("R", "REJ", "REJECT") else 0.0
        mic_lambda = MIC_DECAY_RATES.get(mic_name, decay_lambda)
        score += weight * math.exp(-mic_lambda * dt)
    return score
