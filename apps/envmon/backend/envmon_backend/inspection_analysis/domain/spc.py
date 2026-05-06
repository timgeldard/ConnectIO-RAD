"""Domain — Statistical Process Control early-warning detection."""


def detect_early_warning(rows: list[dict]) -> bool:
    """Return True if the last 3 quantitative results show strict monotonic increase.

    This is a leading-indicator pattern: three consecutive increasing values suggest
    a location is trending towards a limit before an actual failure is recorded.
    """
    if len(rows) < 3:
        return False
    vals: list[float] = []
    for r in rows:
        v = r.get("quantitative_result")
        if v is not None:
            try:
                vals.append(float(v))
            except (ValueError, TypeError):
                continue
    if len(vals) < 3:
        return False
    last3 = vals[-3:]
    return last3[2] > last3[1] > last3[0]
