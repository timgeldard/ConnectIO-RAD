"""Tests for the global SQL query audit hook system."""

import asyncio

from shared_db.audit import (
    QueryAuditHook,
    _audit_hooks,
    _fire_global_audit_hooks,
    _token_hash,
    register_audit_hook,
)


def _clear_hooks():
    """Remove all registered audit hooks between tests."""
    _audit_hooks.clear()


class _RecordingHook:
    """Test double that records every audit call."""

    def __init__(self):
        self.calls: list[dict] = []

    async def record(self, **kwargs) -> None:
        self.calls.append(kwargs)


class _RaisingHook:
    """Test double that always raises from record()."""

    async def record(self, **kwargs) -> None:
        raise RuntimeError("hook exploded")


def test_register_and_fire_audit_hook():
    _clear_hooks()
    hook = _RecordingHook()
    register_audit_hook(hook)

    asyncio.run(
        _fire_global_audit_hooks(
            token="tok",
            statement="SELECT 1",
            params=None,
            endpoint_hint="test.endpoint",
            elapsed_ms=42,
            rows=[{"ok": True}],
            error=None,
        )
    )

    assert len(hook.calls) == 1
    call = hook.calls[0]
    assert call["endpoint_hint"] == "test.endpoint"
    assert call["elapsed_ms"] == 42
    assert call["rows"] == [{"ok": True}]
    assert call["error"] is None
    _clear_hooks()


def test_audit_hook_receives_token_hash_not_raw_token():
    _clear_hooks()
    hook = _RecordingHook()
    register_audit_hook(hook)

    asyncio.run(
        _fire_global_audit_hooks(
            token="secret-token",
            statement="SELECT 1",
            params=None,
            endpoint_hint="test",
            elapsed_ms=1,
            rows=[],
            error=None,
        )
    )

    call = hook.calls[0]
    assert "secret-token" not in call["user_token_hash"]
    assert len(call["user_token_hash"]) == 16
    _clear_hooks()


def test_raising_hook_does_not_prevent_other_hooks():
    _clear_hooks()
    raiser = _RaisingHook()
    recorder = _RecordingHook()
    register_audit_hook(raiser)
    register_audit_hook(recorder)

    asyncio.run(
        _fire_global_audit_hooks(
            token="tok",
            statement="SELECT 1",
            params=None,
            endpoint_hint="test",
            elapsed_ms=1,
            rows=[],
            error=None,
        )
    )

    assert len(recorder.calls) == 1
    _clear_hooks()


def test_fire_with_no_hooks_is_a_no_op():
    _clear_hooks()
    asyncio.run(
        _fire_global_audit_hooks(
            token="tok",
            statement="SELECT 1",
            params=None,
            endpoint_hint="test",
            elapsed_ms=1,
            rows=[],
            error=None,
        )
    )


def test_token_hash_is_stable_and_short():
    h1 = _token_hash("my-token")
    h2 = _token_hash("my-token")
    h3 = _token_hash("other-token")

    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 16


def test_recording_hook_satisfies_protocol():
    hook = _RecordingHook()
    assert isinstance(hook, QueryAuditHook)
