"""Pure control chart mathematics — no DB or framework dependencies."""

import math
from typing import List, Tuple

D2_TABLE: dict[int, float] = {
    2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704,
    8: 2.847, 9: 2.970, 10: 3.078, 11: 3.173, 12: 3.258, 13: 3.336,
    14: 3.407, 15: 3.472,
}


def mean(values: List[float]) -> float:
    """
    Calculate the arithmetic mean of a list of floats.

    Args:
        values: List of numeric values.

    Returns:
        The arithmetic mean, or 0.0 if the list is empty.
    """
    if not values:
        return 0.0
    return sum(values) / len(values)


def stddev(values: List[float], ddof: int = 1) -> float:
    """
    Calculate the sample standard deviation.

    Args:
        values: List of numeric values.
        ddof: Delta Degrees of Freedom (default 1 for sample stddev).

    Returns:
        The standard deviation, or 0.0 if there are fewer than 2 points.
    """
    if len(values) < 2:
        return 0.0
    m = mean(values)
    return math.sqrt(sum((x - m) ** 2 for x in values) / (len(values) - ddof))


def moving_range(values: List[float]) -> List[float]:
    """
    Calculate the absolute differences between successive points.

    Used to estimate process variation for individuals (I-MR) charts.

    Args:
        values: List of numeric values.

    Returns:
        A list of n-1 moving range values.
    """
    if len(values) < 2:
        return []
    return [abs(values[i] - values[i - 1]) for i in range(1, len(values))]


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
    x_bar = mean(values)
    mr = moving_range(values)
    mr_bar = mean(mr)
    d2 = 1.128
    sigma_within = mr_bar / d2
    ucl = x_bar + 3 * sigma_within
    lcl = x_bar - 3 * sigma_within
    return lcl, x_bar, ucl


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
    violations = {i: [] for i in range(1, 9)}
    if sigma <= 0:
        return violations

    z_scores = [(x - centerline) / sigma for x in values]

    for i, z in enumerate(z_scores):
        if abs(z) > 3:
            violations[1].append(i)

        if i >= 8:
            # Rule 2: 9 consecutive points on the same side of the centerline.
            # Window spans indices [i-8, i] inclusive.
            window = z_scores[i - 8:i + 1]
            if all(w > 0 for w in window) or all(w < 0 for w in window):
                violations[2].append(i)

        if i >= 5:
            # Rule 3: 6 consecutive points steadily increasing or decreasing.
            # Window spans indices [i-5, i] inclusive (5 consecutive differences).
            # Follows Montgomery (2009) / Nelson (1984) standard.
            window = values[i - 5:i + 1]
            if all(window[j] > window[j - 1] for j in range(1, 6)) or \
               all(window[j] < window[j - 1] for j in range(1, 6)):
                violations[3].append(i)

        if i >= 13:
            window = values[i - 13:i + 1]
            diffs = [window[j] - window[j - 1] for j in range(1, 14)]
            if all(diffs[j] * diffs[j - 1] < 0 for j in range(1, 13)):
                violations[4].append(i)

        if i >= 2:
            window = z_scores[i - 2:i + 1]
            if sum(1 for w in window if w > 2) >= 2 or \
               sum(1 for w in window if w < -2) >= 2:
                violations[5].append(i)

        if i >= 4:
            window = z_scores[i - 4:i + 1]
            if sum(1 for w in window if w > 1) >= 4 or \
               sum(1 for w in window if w < -1) >= 4:
                violations[6].append(i)

        if i >= 14:
            window = z_scores[i - 14:i + 1]
            if all(abs(w) < 1 for w in window):
                violations[7].append(i)

        if i >= 7:
            window = z_scores[i - 7:i + 1]
            if all(abs(w) > 1 for w in window) and \
               not (all(w > 1 for w in window) or all(w < -1 for w in window)):
                violations[8].append(i)

    return violations
