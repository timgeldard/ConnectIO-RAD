"""Generate OpenAPI specs for every backend, then run openapi-typescript on each.

This is the H-1 architecture-review fix.  Previously frontend TypeScript types
duplicated backend Pydantic schemas by hand, so a backend rename silently
bypassed type checking and only surfaced at runtime.

The script:

1. Imports each backend's FastAPI app object (in-process — no uvicorn).
2. Calls ``app.openapi()`` to extract the spec.
3. Writes ``apps/<app>/backend/openapi.json``.
4. Invokes ``npx openapi-typescript`` to render a TypeScript types file at
   ``libs/shared-frontend-api/src/generated/<app>.ts``.

The generated directory is gitignored output; CI commits nothing, but the
``check`` mode (``--check``) fails if the generated output differs from a
freshly regenerated copy.  That gate forces drift to surface in PR review.

Usage
-----
    python scripts/generate_openapi.py              # write specs + types
    python scripts/generate_openapi.py --check      # fail if anything would change

Requires:
- ``uv sync --all-packages`` (so each app's package is importable)
- ``npm install`` (so ``openapi-typescript`` is on the path)
"""
from __future__ import annotations

import argparse
import importlib
import json
import shutil
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent

# Map app slug → (FastAPI module path, attribute on the module).  ``fastapi_app``
# is the convention adopted in shared-api ``ConnectIoApp``.
BACKENDS: dict[str, tuple[str, str]] = {
    "spc": ("spc_backend.main", "fastapi_app"),
    "trace2": ("trace2_backend.main", "fastapi_app"),
    "envmon": ("envmon_backend.main", "fastapi_app"),
    "warehouse360": ("warehouse360_backend.main", "fastapi_app"),
    "poh": ("processorderhistory_backend.main", "fastapi_app"),
    "connectedquality": ("connectedquality_backend.main", "fastapi_app"),
    "platform": ("platform_backend.main", "fastapi_app"),
}

OPENAPI_DIR_TEMPLATE = "apps/{slug}/backend/openapi.json"
TS_DIR = REPO_ROOT / "libs" / "shared-frontend-api" / "src" / "generated"


def _serialize_spec(spec: dict[str, Any]) -> str:
    """Serialize an OpenAPI spec dict to its canonical on-disk form.

    The exact same encoding must be used by the generator and the ``--check``
    drift detector — otherwise CI surfaces phantom differences from JSON
    formatting alone.  Centralising the encoding here is the single source
    of truth.

    Args:
        spec: An OpenAPI spec dict as returned by ``FastAPI.openapi()``.

    Returns:
        A UTF-8-friendly string with 2-space indent, sorted keys, and a
        trailing newline.
    """
    return json.dumps(spec, indent=2, sort_keys=True) + "\n"


def _import_app(module_path: str, attr: str):
    """Import the backend module and return its FastAPI ``app`` object.

    Unwraps ``ConnectIoApp`` wrappers automatically — apps that expose their
    framework wrapper rather than the raw FastAPI instance still produce a
    valid spec because we follow ``.fastapi_app`` when present.

    Args:
        module_path: Dotted module path, e.g. ``"spc_backend.main"``.
        attr: Attribute on the module that holds the app, typically
            ``"fastapi_app"``.

    Returns:
        The FastAPI application instance (with ``.openapi()`` available).

    Raises:
        ImportError: If ``module_path`` cannot be imported.
        AttributeError: If ``attr`` is missing from the imported module.
    """
    module = importlib.import_module(module_path)
    obj = getattr(module, attr)
    # ConnectIoApp wraps FastAPI — call .fastapi_app if needed.
    if hasattr(obj, "fastapi_app"):
        obj = obj.fastapi_app
    return obj


def _dump_openapi(slug: str, module_path: str, attr: str) -> Path:
    """Generate ``apps/<slug>/backend/openapi.json`` and return its path.

    Args:
        slug: App slug used in the output path (e.g. ``"spc"``).
        module_path: Dotted module path for the backend's FastAPI entry point.
        attr: Attribute name carrying the FastAPI/ConnectIoApp instance.

    Returns:
        Absolute path of the written ``openapi.json`` file.

    Raises:
        ImportError, AttributeError: Propagated from :func:`_import_app`.
        OSError: If the output directory cannot be created or written.
    """
    app = _import_app(module_path, attr)
    text = _serialize_spec(app.openapi())
    out = REPO_ROOT / OPENAPI_DIR_TEMPLATE.format(slug=slug)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    return out


def _render_ts_types(slug: str, openapi_path: Path) -> Path:
    """Run ``npx openapi-typescript`` and write a per-app TypeScript types file.

    Args:
        slug: App slug, used to name the output as ``<slug>.ts``.
        openapi_path: Path to the input ``openapi.json``.

    Returns:
        Absolute path of the generated TypeScript module.

    Raises:
        subprocess.CalledProcessError: If ``openapi-typescript`` exits non-zero.
        OSError: If ``npx`` cannot be invoked or the output cannot be written.
    """
    TS_DIR.mkdir(parents=True, exist_ok=True)
    out = TS_DIR / f"{slug}.ts"
    cmd = [
        "npx",
        "--yes",
        "openapi-typescript",
        str(openapi_path),
        "-o",
        str(out),
    ]
    subprocess.run(cmd, check=True, cwd=REPO_ROOT)
    return out


def _diff(a: Path, b: Path) -> str:
    """Return a unified diff between two text files, or empty string if equal.

    Used by ``--check`` to format human-readable drift output.  Missing files
    are treated as empty strings so the caller can show an added or removed
    file as a full insertion/deletion.

    Args:
        a: Reference file (committed copy in the repo).
        b: Comparison file (freshly regenerated into a tempdir).

    Returns:
        A unified-diff string when the contents differ, empty string when
        they match.
    """
    text_a = a.read_text(encoding="utf-8") if a.exists() else ""
    text_b = b.read_text(encoding="utf-8") if b.exists() else ""
    if text_a == text_b:
        return ""
    import difflib

    return "".join(
        difflib.unified_diff(
            text_a.splitlines(keepends=True),
            text_b.splitlines(keepends=True),
            fromfile=str(a),
            tofile=str(b),
            n=3,
        )
    )


def main(argv: list[str] | None = None) -> int:
    """CLI entry point for the OpenAPI regeneration / drift-check script.

    Args:
        argv: Optional argv slice for testing.  When ``None``, ``argparse``
            uses ``sys.argv`` as usual.  Recognised flags:
            ``--check`` (compare committed specs against a fresh regen),
            ``--app <slug>`` (limit to a single backend).

    Returns:
        ``0`` on success.  ``1`` on import failure or, in ``--check`` mode,
        when drift is detected.

    Raises:
        SystemExit: Propagated from ``argparse`` when ``--help`` is supplied
            or when an unknown flag is passed.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Do not modify files; fail if regeneration would change anything.",
    )
    parser.add_argument(
        "--app",
        help="Limit to a single app slug (e.g. spc, trace2). Default: all.",
    )
    args = parser.parse_args(argv)

    targets = {args.app: BACKENDS[args.app]} if args.app else BACKENDS

    if args.check:
        # Generate into a tmpdir and diff against the committed files.
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            drift: list[str] = []
            for slug, (module_path, attr) in targets.items():
                try:
                    app = _import_app(module_path, attr)
                except Exception as exc:  # noqa: BLE001
                    # Top-level CLI: any import failure must surface clearly
                    # rather than crash the script. Narrow except types would
                    # let unrelated failures (RecursionError from a circular
                    # import, IO errors during module load) escape silently.
                    # We compensate by printing the full traceback so the
                    # operator has enough to debug.
                    print(f"[error] cannot import {slug}: {exc}", file=sys.stderr)
                    traceback.print_exc(file=sys.stderr)
                    return 1
                spec = _serialize_spec(app.openapi())
                tmp_spec = tmp / f"{slug}.openapi.json"
                tmp_spec.write_text(spec, encoding="utf-8")
                committed = REPO_ROOT / OPENAPI_DIR_TEMPLATE.format(slug=slug)
                d = _diff(committed, tmp_spec)
                if d:
                    drift.append(f"=== {slug} openapi.json drift ===\n{d}")
            if drift:
                print("\n".join(drift), file=sys.stderr)
                print(
                    "\nOpenAPI specs are stale. Run `python scripts/generate_openapi.py` "
                    "and commit the result.",
                    file=sys.stderr,
                )
                return 1
            print("All OpenAPI specs are up to date.")
            return 0

    # Full regenerate
    has_npx = shutil.which("npx") is not None
    for slug, (module_path, attr) in targets.items():
        print(f"[gen] {slug}: dumping openapi.json")
        spec = _dump_openapi(slug, module_path, attr)
        if has_npx:
            print(f"[gen] {slug}: rendering TypeScript types")
            _render_ts_types(slug, spec)
        else:
            print(f"[skip] {slug}: npx not available, skipping TS codegen")
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
