"""Process capability indices, normality testing, and Cpk classification thresholds."""

import math
from typing import List, Optional

from backend.process_control.domain.control_charts import mean, moving_range, stddev

# Cpk capability thresholds — single source of truth shared by backend and tests.
# Matching values are exported from frontend/src/spc/spcConstants.js.
CPK_HIGHLY_CAPABLE: float = 1.67
CPK_CAPABLE: float = 1.33
CPK_MARGINAL: float = 1.00


def normal_cdf(z: float) -> float:
    """
    Calculate the cumulative distribution function for a standard normal distribution.

    Uses the Abramowitz & Stegun 26.2.17 approximation, with a maximum error of 7.5e-8.

    Args:
        z: The Z-score (standardized value) for which to calculate the CDF.

    Returns:
        The probability that a standard normal variable is less than or equal to z.
    """
    t = 1 / (1 + 0.2316419 * abs(z))
    poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    base = 1 - (1 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * z * z) * poly
    return base if z >= 0 else 1 - base


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
    if n < 25:
        return None, None
    se = math.sqrt(1 / (9 * n) + cpk ** 2 / (2 * (n - 1)))
    lower = round(cpk - 1.96 * se, 3)
    upper = round(cpk + 1.96 * se, 3)
    return lower, upper


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
    if usl is not None and lsl is not None:
        if nominal is not None:
            upper_span = usl - nominal
            lower_span = nominal - lsl
            if math.isclose(abs(upper_span), abs(lower_span), rel_tol=1e-6, abs_tol=1e-6):
                return "bilateral_symmetric"
            return "bilateral_asymmetric"
        return "bilateral_symmetric"
    if usl is not None:
        return "unilateral_upper"
    if lsl is not None:
        return "unilateral_lower"
    return "unspecified"


def compute_normality_result(values: list[Optional[float]]) -> dict:
    """
    Evaluate if a dataset follows a normal distribution using Shapiro-Wilk.

    Args:
        values: A list of potentially null/non-numeric observation values.

    Returns:
        A dictionary containing "is_normal" (bool), "p_value", and "method".
        Includes a "warning" if normality testing was skipped or sampled.
    """
    alpha = 0.05
    valid_values = [
        float(v) for v in values
        if v is not None and isinstance(v, (int, float)) and math.isfinite(v)
    ]
    result = {
        "method": "shapiro_wilk",
        "p_value": None,
        "alpha": alpha,
        "is_normal": None,
        "warning": None,
    }

    if len(valid_values) < 3:
        result["warning"] = "Normality requires at least 3 quantitative points."
        return result

    try:
        from scipy.stats import shapiro
    except ImportError:
        result["warning"] = "scipy is not installed; Shapiro-Wilk normality testing skipped."
        return result

    sample = valid_values
    if len(valid_values) > 5000:
        last_index = len(valid_values) - 1
        sample = [valid_values[round(i * last_index / 4999)] for i in range(5000)]
        result["method"] = "shapiro_wilk_sampled"
        result["warning"] = (
            "Dataset exceeded 5000 points; normality was evaluated on an evenly "
            "sampled 5000-point subset."
        )

    try:
        _, p_value = shapiro(sample)
    except Exception as exc:  # pragma: no cover
        result["warning"] = f"Normality test failed: {str(exc)[:160]}"
        return result

    if p_value is None or math.isnan(float(p_value)):
        result["warning"] = "Shapiro-Wilk returned an invalid p-value."
        return result

    result["p_value"] = round(float(p_value), 6)
    result["is_normal"] = bool(float(p_value) >= alpha)
    return result


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
    mu = mean(values)
    s_overall = stddev(values, ddof=1)

    mr = moving_range(values)
    mr_bar = mean(mr)
    d2 = 1.128
    sigma_within = mr_bar / d2

    results = {}

    if usl is not None and lsl is not None:
        results["cp"] = (usl - lsl) / (6 * sigma_within) if sigma_within > 0 else None

    if usl is not None or lsl is not None:
        cpk_u = (usl - mu) / (3 * sigma_within) if usl is not None and sigma_within > 0 else float("inf")
        cpk_l = (mu - lsl) / (3 * sigma_within) if lsl is not None and sigma_within > 0 else float("inf")
        results["cpk"] = min(cpk_u, cpk_l)

    if usl is not None and lsl is not None:
        results["pp"] = (usl - lsl) / (6 * s_overall) if s_overall > 0 else None

    if usl is not None or lsl is not None:
        ppk_u = (usl - mu) / (3 * s_overall) if usl is not None and s_overall > 0 else float("inf")
        ppk_l = (mu - lsl) / (3 * s_overall) if lsl is not None and s_overall > 0 else float("inf")
        results["ppk"] = min(ppk_u, ppk_l)

    if target is not None and usl is not None and lsl is not None:
        denom = 6 * math.sqrt(s_overall ** 2 + (mu - target) ** 2)
        results["cpm"] = (usl - lsl) / denom if denom > 0 else None

    return results


def compute_non_parametric_capability(
    values: List[float],
    usl: Optional[float] = None,
    lsl: Optional[float] = None,
) -> dict:
    """
    ISO 22514-2 (Percentile Method).

    Requires a minimum sample size of 125 to provide stable Ppk estimates.
    Returns an empty dict with a warning if n < 125.
    """
    if not values:
        return {}

    n = len(values)
    if n < 125:
        return {"warning": f"Non-parametric Ppk requires n >= 125 (received n={n})."}

    sorted_vals = sorted(values)

    def get_percentile(p: float) -> float:
        idx = p * (n - 1)
        i = math.floor(idx)
        d = idx - i
        if i >= n - 1:
            return sorted_vals[-1]
        return sorted_vals[i] * (1 - d) + sorted_vals[i + 1] * d

    p00135 = get_percentile(0.00135)
    p50 = get_percentile(0.5)
    p99865 = get_percentile(0.99865)

    results = {}
    if usl is not None or lsl is not None:
        ppk_u = (usl - p50) / (p99865 - p50) if usl is not None and p99865 > p50 else float("inf")
        ppk_l = (p50 - lsl) / (p50 - p00135) if lsl is not None and p50 > p00135 else float("inf")
        results["ppk_non_parametric"] = min(ppk_u, ppk_l)

    return results
