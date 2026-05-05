"""Unit tests for SPC process_control application layer — analysis functions.

These tests verify msa_calculate dispatch logic by importing only the domain
layer (which has no infrastructure dependencies) and patching the problematic
DAL import chain so the module can load in the test environment.
"""

from __future__ import annotations

import sys
from types import ModuleType
from unittest.mock import MagicMock, patch


def _stub_infrastructure() -> None:
    """Inject stub modules for infrastructure deps that are unavailable in the
    test environment (shared_trace.schema, databricks sql connector, etc.).

    Called once before importing any backend module that chains through
    backend.utils.db.
    """
    stubs = [
        "shared_trace.schema",
        "databricks",
        "databricks.sql",
    ]
    for name in stubs:
        if name not in sys.modules:
            sys.modules[name] = MagicMock()


_stub_infrastructure()

from backend.process_control.application import analysis as analysis_module  # noqa: E402
from backend.process_control.application.analysis import msa_calculate  # noqa: E402
from backend.schemas.spc_schemas import CalculateMSARequest  # noqa: E402

_SAMPLE_DATA = [
    [[10.5, 10.2, 10.8], [10.6, 10.3, 10.9]],
    [[10.4, 10.7, 10.1], [10.5, 10.8, 10.2]],
]


def _make_request(method: str = "average_range") -> CalculateMSARequest:
    return CalculateMSARequest(
        measurement_data=_SAMPLE_DATA,
        tolerance=1.0,
        method=method,
    )


class TestMsaCalculate:
    def test_delegates_to_compute_grr_for_average_range(self) -> None:
        sentinel = {"grr_pct": 5.0}
        with patch.object(analysis_module, "compute_grr", return_value=sentinel) as mock_grr:
            result = msa_calculate(_make_request("average_range"))

        mock_grr.assert_called_once_with(_SAMPLE_DATA, 1.0)
        assert result is sentinel

    def test_delegates_to_compute_grr_anova_for_anova_method(self) -> None:
        sentinel = {"grr_pct": 7.5}
        with patch.object(analysis_module, "compute_grr_anova", return_value=sentinel) as mock_anova:
            result = msa_calculate(_make_request("anova"))

        mock_anova.assert_called_once_with(_SAMPLE_DATA, 1.0)
        assert result is sentinel

    def test_does_not_call_anova_for_average_range(self) -> None:
        with (
            patch.object(analysis_module, "compute_grr"),
            patch.object(analysis_module, "compute_grr_anova") as mock_anova,
        ):
            msa_calculate(_make_request("average_range"))

        mock_anova.assert_not_called()

    def test_does_not_call_average_range_for_anova(self) -> None:
        with (
            patch.object(analysis_module, "compute_grr") as mock_grr,
            patch.object(analysis_module, "compute_grr_anova"),
        ):
            msa_calculate(_make_request("anova"))

        mock_grr.assert_not_called()
