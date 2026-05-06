"""Domain logic for inspection risk analysis.

This module provides functions to calculate risk scores for functional locations
based on historical inspection results, applying weighted exponential time decay
to prioritize recent failures.
"""

import math
from datetime import date

from envmon_backend.inspection_analysis.domain.valuation import REJECT_VALUATIONS, normalize_valuation


def calculate_risk_score(
    rows: list[dict],
    today: date,
    decay_lambda: float,
    mic_decay_rates: dict[str, float] | None = None,
) -> float:
    """Compute weighted exponential-decay risk score for a location's result rows.

    Each failing result contributes weight * e^(-lambda * days_ago). Passing results
    contribute zero weight. MIC-specific lambdas from configuration override the
    system default lambda.

    The score represents the cumulative risk posed by historical inspection
    failures, where older failures are weighted less heavily than recent ones.

    Args:
        rows: A list of dictionaries representing inspection result rows for a
            functional location. Each row should contain 'valuation', 'mic_name',
            and 'lot_date'.
        today: The reference date used as "now" to compute the age of each result.
        decay_lambda: The default exponential decay constant (lambda) to use
            if no MIC-specific override is found.
        mic_decay_rates: Optional dictionary mapping MIC names to specific
            decay constants.

    Returns:
        The total calculated risk score as a float. A score of 0.0 indicates
        no recent failures.

    Raises:
        TypeError: If rows is not a list or today is not a date object.
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
