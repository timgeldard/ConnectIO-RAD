"""Unit tests for chart_config domain value objects."""

import pytest

from shared_domain import BusinessRuleValidationException
from spc_backend.chart_config.domain.locked_limits import LockedLimits
from spc_backend.chart_config.domain.exclusion import Exclusion


class TestLockedLimits:
    def _valid(self, **overrides):
        defaults = dict(material_id="MAT-1", mic_id="MIC-1", chart_type="imr", cl=10.0, ucl=12.0, lcl=8.0)
        defaults.update(overrides)
        return LockedLimits(**defaults)

    def test_valid_imr_limits_construct(self):
        ll = self._valid()
        assert ll.material_id == "MAT-1"
        assert ll.ucl == 12.0

    def test_rejects_empty_material_id(self):
        with pytest.raises(BusinessRuleValidationException, match="material_id"):
            self._valid(material_id="")

    def test_rejects_empty_mic_id(self):
        with pytest.raises(BusinessRuleValidationException, match="mic_id"):
            self._valid(mic_id="")

    def test_rejects_unknown_chart_type(self):
        with pytest.raises(BusinessRuleValidationException, match="chart_type"):
            self._valid(chart_type="bad_chart")

    def test_rejects_ucl_not_greater_than_lcl(self):
        with pytest.raises(BusinessRuleValidationException, match="ucl must be > lcl"):
            self._valid(ucl=8.0, lcl=8.0)

    def test_rejects_ucl_less_than_lcl(self):
        with pytest.raises(BusinessRuleValidationException, match="ucl must be > lcl"):
            self._valid(ucl=7.0, lcl=8.0)

    def test_p_chart_allows_equal_ucl_lcl(self):
        ll = self._valid(chart_type="p_chart", ucl=0.0, lcl=0.0)
        assert ll.chart_type == "p_chart"

    def test_p_chart_rejects_ucl_less_than_lcl(self):
        with pytest.raises(BusinessRuleValidationException, match="ucl must be >= lcl for p_chart"):
            self._valid(chart_type="p_chart", ucl=-0.1, lcl=0.0)

    def test_all_recognised_chart_types_accepted(self):
        for ct in ("imr", "xbar_r", "xbar_s", "ewma", "cusum", "p_chart", "np_chart", "c_chart", "u_chart"):
            ll = self._valid(chart_type=ct)
            assert ll.chart_type == ct

    def test_frozen_cannot_be_mutated(self):
        ll = self._valid()
        with pytest.raises(Exception):
            ll.cl = 99.0  # type: ignore[misc]

    def test_optional_fields_default_to_none(self):
        ll = self._valid()
        assert ll.plant_id is None
        assert ll.operation_id is None
        assert ll.locking_note is None


class TestExclusion:
    def _valid(self, **overrides):
        defaults = dict(material_id="MAT-1", mic_id="MIC-1", chart_type="imr", justification="bad outlier")
        defaults.update(overrides)
        return Exclusion(**defaults)

    def test_valid_exclusion_constructs(self):
        ex = self._valid()
        assert ex.material_id == "MAT-1"
        assert ex.justification == "bad outlier"

    def test_rejects_empty_material_id(self):
        with pytest.raises(BusinessRuleValidationException, match="material_id"):
            self._valid(material_id="")

    def test_rejects_empty_mic_id(self):
        with pytest.raises(BusinessRuleValidationException, match="mic_id"):
            self._valid(mic_id="")

    def test_rejects_unknown_chart_type(self):
        with pytest.raises(BusinessRuleValidationException, match="chart_type"):
            self._valid(chart_type="not_a_chart")

    def test_rejects_short_justification(self):
        with pytest.raises(BusinessRuleValidationException, match="justification"):
            self._valid(justification="  ")

    def test_rejects_invalid_stratify_by(self):
        with pytest.raises(BusinessRuleValidationException, match="stratify_by"):
            self._valid(stratify_by="bad_column")

    def test_valid_stratify_by_values(self):
        for key in ("plant_id", "inspection_lot_id", "operation_id"):
            ex = self._valid(stratify_by=key)
            assert ex.stratify_by == key

    def test_allowed_chart_types(self):
        for ct in ("imr", "xbar_r", "p_chart"):
            ex = self._valid(chart_type=ct)
            assert ex.chart_type == ct

    def test_frozen_cannot_be_mutated(self):
        ex = self._valid()
        with pytest.raises(Exception):
            ex.justification = "changed"  # type: ignore[misc]
