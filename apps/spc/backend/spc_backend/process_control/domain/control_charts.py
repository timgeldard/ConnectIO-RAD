"""Pure control chart mathematics — no DB or framework dependencies."""

from typing import List, Tuple

from shared_manufacturing.analytics.spc import (
    compute_imr_limits as _compute_imr_limits,
)
from shared_manufacturing.analytics.spc import (
    detect_nelson_rules as _detect_nelson_rules,
)
from shared_manufacturing.analytics.spc import mean as _mean
from shared_manufacturing.analytics.spc import moving_range as _moving_range
from shared_manufacturing.analytics.spc import stddev as _stddev


def mean(values: List[float]) -> float:
    """
    Calculate the arithmetic mean of a list of floats.

    Args:
        values: List of numeric values.

    Returns:
        The arithmetic mean, or 0.0 if the list is empty.
    """
    return _mean(values)


def stddev(values: List[float], ddof: int = 1) -> float:
    """
    Calculate the sample standard deviation.

    Args:
        values: List of numeric values.
        ddof: Delta Degrees of Freedom (default 1 for sample stddev).

    Returns:
        The standard deviation, or 0.0 if there are fewer than 2 points.
    """
    return _stddev(values, ddof)


def moving_range(values: List[float]) -> List[float]:
    """
    Calculate the absolute differences between successive points.

    Used to estimate process variation for individuals (I-MR) charts.

    Args:
        values: List of numeric values.

    Returns:
        A list of n-1 moving range values.
    """
    return _moving_range(values)


def compute_imr_limits(values: List[float]) -> Tuple[float, float, float]:
    """
    Compute I-MR (Individual-Moving Range) control limits.

    Uses the average moving range (MR-bar) and the d2 constant (1.128 for n=2)
    to estimate 'within-batch' sigma.

    Args:
        values: List of numeric values.

    Returns:
        A tuple of (lower_control_limit, centerline, upper_control_limit).
    """
    return _compute_imr_limits(values)


def detect_nelson_rules(values: List[float], centerline: float, sigma: float) -> dict:
    """
    Detect Nelson Rules 1-8 for a series of observations.

    Nelson rules identify 'out-of-control' or non-random patterns in
    statistical process control.

    Args:
        values: List of numeric observation values.
        centerline: The process mean or target centerline.
        sigma: The process standard deviation (sigma).

    Returns:
        A dictionary mapping rule numbers (1-8) to lists of violating indices.
    """
    return _detect_nelson_rules(values, centerline, sigma)
