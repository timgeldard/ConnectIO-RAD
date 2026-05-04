"""Domain — risk score calculation using weighted exponential time decay."""

import math
from datetime import date

from backend.inspection_analysis.domain.valuation import REJECT_VALUATIONS, normalize_valuation


def calculate_risk_score(
    rows: list[dict],
    today: date,
    decay_lambda: float,
    mic_decay_rates: dict[str, float] | None = None,
) -> float:
    """Compute weighted exponential-decay risk score for a location's result rows.

    Each failing result contributes weight * e^(-lambda * days_ago). Passing results
    contribute zero weight. MIC-specific lambdas from config override the default.

    Args:
        rows: Result rows for one functional location.
        today: Reference date used to compute age-based decay.
        decay_lambda: Default exponential decay lambda.
        mic_decay_rates: Optional MIC-specific lambdas keyed by MIC name.

    Returns:
        Weighted risk score for the location.
    """
    decay_rates = {key.upper().strip(): value for key, value in mic_decay_rates.items()} if mic_decay_rates else {}
    score = 0.0
    for r in rows:
        val = normalize_valuation(r.get("valuation"))
        mic_name = (r.get("mic_name") or "").upper().strip()
        created_str = r.get("lot_date")
        if not created_str:
            continue
        try:
            created = date.fromisoformat(str(created_str))
        except ValueError:
            continue
        dt = max((today - created).days, 0)
        weight = 10.0 if val in REJECT_VALUATIONS else 0.0
        mic_lambda = decay_rates.get(mic_name, decay_lambda)
        score += weight * math.exp(-mic_lambda * dt)
    return score
