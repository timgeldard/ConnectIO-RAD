#!/usr/bin/env python3
"""Validate frontend i18n dictionaries."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_LANGUAGES = ("en", "de", "fr", "es", "ja", "pt", "id", "ms", "ga", "pl", "nl", "uk", "da", "vi", "zh-Hans", "zh-Hant")
PLACEHOLDER_RE = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def placeholders(value: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(value))


def validate_resource(path: Path) -> list[str]:
    errors: list[str] = []
    data = load_json(path)
    missing_languages = [language for language in REQUIRED_LANGUAGES if language not in data]
    if missing_languages:
        errors.append(f"{path.relative_to(ROOT)} missing languages: {', '.join(missing_languages)}")
        return errors

    english_keys = set(data["en"])
    english_placeholders = {
        key: placeholders(value)
        for key, value in data["en"].items()
        if isinstance(value, str)
    }
    for language in REQUIRED_LANGUAGES:
        values = data.get(language, {})
        if not isinstance(values, dict):
            errors.append(f"{path.relative_to(ROOT)} language `{language}` must be an object")
            continue
        keys = set(values)
        missing = sorted(english_keys - keys)
        extra = sorted(keys - english_keys)
        empty = sorted(key for key, value in values.items() if not isinstance(value, str) or not value.strip())
        placeholder_drift = sorted(
            key
            for key, value in values.items()
            if isinstance(value, str) and placeholders(value) != english_placeholders.get(key, set())
        )
        if missing:
            errors.append(f"{path.relative_to(ROOT)} `{language}` missing keys: {', '.join(missing)}")
        if extra:
            errors.append(f"{path.relative_to(ROOT)} `{language}` has extra keys: {', '.join(extra)}")
        if empty:
            errors.append(f"{path.relative_to(ROOT)} `{language}` has empty/non-string values: {', '.join(empty)}")
        if placeholder_drift:
            errors.append(f"{path.relative_to(ROOT)} `{language}` has placeholder drift: {', '.join(placeholder_drift)}")
    return errors


def main() -> int:
    resource_files = sorted((ROOT / "apps").glob("*/frontend/src/i18n/resources.json"))
    errors: list[str] = []
    if not resource_files:
        errors.append("No app i18n resource files found")
    for path in resource_files:
        errors.extend(validate_resource(path))

    if errors:
        print("i18n validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"i18n validation passed for {len(resource_files)} app resource files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
