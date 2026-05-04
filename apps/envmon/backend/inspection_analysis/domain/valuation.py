"""Domain constants and helpers for inspection-result valuations."""

ACCEPT_VALUATIONS = frozenset({"A", "ACC", "ACCEPT"})
REJECT_VALUATIONS = frozenset({"R", "REJ", "REJECT"})


def normalize_valuation(value: object) -> str:
    """Normalize a source valuation value for domain comparisons.

    Args:
        value: Raw valuation value from a Databricks row or API payload.

    Returns:
        The stripped uppercase valuation string, or an empty string for null-ish
        values.
    """
    return str(value or "").upper().strip()
