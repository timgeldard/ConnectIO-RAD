"""Domain constants and helpers for inspection-result valuations.

This module provides standard valuation sets and utility functions for
normalizing raw valuation data from external sources into a consistent
domain format.
"""

ACCEPT_VALUATIONS = frozenset({"A", "ACC", "ACCEPT"})
REJECT_VALUATIONS = frozenset({"R", "REJ", "REJECT"})


def normalize_valuation(value: object) -> str:
    """Normalize a source valuation value for domain comparisons.

    Strips whitespace and converts the value to uppercase to ensure
    consistent matching against accepted and rejected valuation sets.

    Args:
        value: Raw valuation value from a source (e.g., Databricks row,
            API payload).

    Returns:
        The stripped uppercase valuation string, or an empty string for
        null-ish values.

    Raises:
        None explicitly. Handles non-string objects by converting them to
        strings first.
    """
    return str(value or "").upper().strip()
