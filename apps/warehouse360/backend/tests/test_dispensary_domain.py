"""Unit tests for dispensary_ops domain — task status derivation."""


from backend.dispensary_ops.domain.task_status import (
    is_urgent,
    normalize_task_status,
)


class TestNormalizeTaskStatus:
    def test_open_maps_correctly(self) -> None:
        assert normalize_task_status("OPEN") == "OPEN"

    def test_in_progress_with_space(self) -> None:
        assert normalize_task_status("IN PROGRESS") == "IN_PROGRESS"

    def test_in_progress_with_underscore(self) -> None:
        assert normalize_task_status("IN_PROGRESS") == "IN_PROGRESS"

    def test_completed_variants(self) -> None:
        assert normalize_task_status("COMPLETED") == "COMPLETED"
        assert normalize_task_status("COMPLETE") == "COMPLETED"
        assert normalize_task_status("DONE") == "COMPLETED"

    def test_overdue_variants(self) -> None:
        assert normalize_task_status("OVERDUE") == "OVERDUE"
        assert normalize_task_status("LATE") == "OVERDUE"

    def test_case_insensitive(self) -> None:
        assert normalize_task_status("open") == "OPEN"
        assert normalize_task_status("Completed") == "COMPLETED"

    def test_leading_trailing_whitespace_stripped(self) -> None:
        assert normalize_task_status("  OPEN  ") == "OPEN"

    def test_none_defaults_to_open(self) -> None:
        assert normalize_task_status(None) == "OPEN"

    def test_unknown_value_defaults_to_open(self) -> None:
        assert normalize_task_status("MYSTERY_STATUS") == "OPEN"


class TestIsUrgent:
    def test_completed_never_urgent(self) -> None:
        assert is_urgent("COMPLETED", 0.0) is False
        assert is_urgent("COMPLETED", -10.0) is False
        assert is_urgent("COMPLETED", None) is False

    def test_overdue_always_urgent(self) -> None:
        assert is_urgent("OVERDUE", None) is True
        assert is_urgent("OVERDUE", 999.0) is True

    def test_open_within_threshold_is_urgent(self) -> None:
        assert is_urgent("OPEN", 30.0) is True
        assert is_urgent("OPEN", 0.0) is True
        assert is_urgent("OPEN", -5.0) is True

    def test_open_beyond_threshold_is_not_urgent(self) -> None:
        assert is_urgent("OPEN", 31.0) is False
        assert is_urgent("OPEN", 60.0) is False

    def test_in_progress_at_boundary(self) -> None:
        assert is_urgent("IN_PROGRESS", 30.0) is True
        assert is_urgent("IN_PROGRESS", 30.1) is False

    def test_none_mins_to_start_is_not_urgent_for_open(self) -> None:
        assert is_urgent("OPEN", None) is False
