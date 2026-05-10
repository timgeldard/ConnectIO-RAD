"""Property tests for Template Module domain primitives."""
from hypothesis import given
from hypothesis import strategies as st

from template_backend.module_template.domain.value_objects import (
    TemplateMetricName,
    TemplateMetricValue,
)


@given(st.text(min_size=1).filter(lambda value: bool(value.strip())))
def test_metric_name_accepts_non_blank_values(value: str) -> None:
    """Metric names preserve valid domain language."""
    assert TemplateMetricName(value).value == value


@given(st.floats(allow_nan=False, allow_infinity=False), st.text(min_size=1).filter(lambda value: bool(value.strip())))
def test_metric_value_preserves_measurement(value: float, unit: str) -> None:
    """Metric values preserve numeric measurements and units."""
    metric = TemplateMetricValue(value=value, unit=unit)

    assert metric.value == value
    assert metric.unit == unit
