"""Process capability indices, normality testing, and Cpk classification thresholds."""

from typing import List, Optional

from shared_manufacturing.analytics.capability import (
    compute_capability_indices as _compute_capability_indices,
)
from shared_manufacturing.analytics.capability import (
    compute_non_parametric_capability as _compute_non_parametric_capability,
)
from shared_manufacturing.analytics.capability import (
    compute_normality_result as _compute_normality_result,
)
from shared_manufacturing.analytics.capability import cpk_ci as _cpk_ci
from shared_manufacturing.analytics.capability import infer_spec_type as _infer_spec_type
from shared_manufacturing.analytics.capability import normal_cdf as _normal_cdf


def normal_cdf(z: float) -> float:
    """
    Calculate the cumulative distribution function for a standard normal distribution.

    Uses scipy.stats.norm.cdf if available, falling back to a math.erf-based
    implementation for GxP-compliant precision (1e-15) when scipy is missing.

    Args:
        z: The Z-score (standardized value) for which to calculate the CDF.

    Returns:
        The probability that a standard normal variable is less than or equal to z.
    """
    return _normal_cdf(z)


def cpk_ci(cpk: float, n: int) -> tuple[Optional[float], Optional[float]]:
    """
    Calculate the 95% confidence interval for a Cpk value.

    Follows the Montgomery (2009) approximation. The interval is considered
    statistically valid only for sample sizes n >= 25.

    Args:
        cpk: The calculated Cpk index.
        n: The number of observation points in the sample.

    Returns:
        A tuple of (lower_bound, upper_bound), or (None, None) if n < 25.
    """
    return _cpk_ci(cpk, n)


def infer_spec_type(
    usl: Optional[float],
    lsl: Optional[float],
    nominal: Optional[float] = None,
) -> str:
    """
    Infer the type of specification (bilateral, unilateral) from limit values.

    Args:
        usl: Upper Specification Limit, if any.
        lsl: Lower Specification Limit, if any.
        nominal: Target or nominal value, used to distinguish symmetric/asymmetric.

    Returns:
        One of: "bilateral_symmetric", "bilateral_asymmetric", "unilateral_upper",
        "unilateral_lower", or "unspecified".
    """
    return _infer_spec_type(usl, lsl, nominal)


def compute_normality_result(values: list[Optional[float]]) -> dict:
    """
    Evaluate if a dataset follows a normal distribution using Shapiro-Wilk.

    Args:
        values: A list of potentially null/non-numeric observation values.

    Returns:
        A dictionary containing "is_normal" (bool), "p_value", and "method".
        Includes a "warning" if normality testing was skipped or sampled.
    """
    return _compute_normality_result(values)


def compute_capability_indices(
    values: List[float],
    usl: Optional[float] = None,
    lsl: Optional[float] = None,
    target: Optional[float] = None,
) -> dict:
    """
    Compute standard process capability indices (Cp, Cpk, Pp, Ppk, Cpm).

    Uses the average moving range (d2=1.128) to estimate within-batch sigma
    for Cp/Cpk, and sample standard deviation for Pp/Ppk.

    Args:
        values: List of numeric observation values.
        usl: Upper Specification Limit.
        lsl: Lower Specification Limit.
        target: Target process value (required for Cpm).

    Returns:
        A dictionary mapping index names to their numeric values.
    """
    return _compute_capability_indices(values, usl, lsl, target)


def compute_non_parametric_capability(
    values: List[float],
    usl: Optional[float] = None,
    lsl: Optional[float] = None,
) -> dict:
    """
    Compute non-parametric process capability using ISO 22514-2 (Percentile Method).

    This method uses the 0.135th, 50th (median), and 99.865th percentiles to
    estimate Ppk without assuming a normal distribution.

    Args:
        values: List of numeric observation values.
        usl: Upper Specification Limit.
        lsl: Lower Specification Limit.

    Returns:
        A dictionary containing "ppk_non_parametric" and optional "warning".
        If n < 125, indices are returned as None with a descriptive warning.
    """
    return _compute_non_parametric_capability(values, usl, lsl)
