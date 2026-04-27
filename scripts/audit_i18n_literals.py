#!/usr/bin/env python3
"""Audit likely hard-coded user-facing frontend strings.

The scanner is intentionally conservative and dependency-free. It is not a
JavaScript parser; it highlights likely UI literals so teams can drive the
remaining migration down over time. Use ``--fail-on-findings`` once an app has
been cleaned enough for CI enforcement.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = tuple(sorted((ROOT / "apps").glob("*/frontend/src")))
EXTENSIONS = {".jsx", ".tsx"}

SKIP_PARTS = {
    "__tests__",
    "__mocks__",
    "i18n",
    "coverage",
    "dist",
    "node_modules",
}
SKIP_NAME_RE = re.compile(r"(\.test|\.spec)\.[jt]sx?$")

JSX_TEXT_RE = re.compile(r">([^<>{}\n][^<>{}]*)<")
PROP_LITERAL_RE = re.compile(
    r"\b(?:aria-label|alt|label|placeholder|title|eyebrow|subtitle|message|loadingTitle)\s*=\s*['\"]([^'\"]*[A-Za-z][^'\"]*)['\"]"
)
OBJECT_LITERAL_RE = re.compile(
    r"\b(?:ariaLabel|emptyLabel|eyebrow|header|label|message|placeholder|subtitle|title)\s*:\s*['\"]([^'\"]*[A-Za-z][^'\"]*)['\"]"
)

IGNORED_LITERAL_RE = re.compile(
    r"^(?:"
    r"[A-Z0-9_ -]{1,12}|"
    r"[a-z0-9_.:-]+|"
    r"[#./][^ ]+|"
    r"\d+(?:[.,:/-]\d+)*|"
    r"var\(--[^)]+\)|"
    r"color-mix\(.+|"
    r"[A-Za-z]+-\d+|"
    r".*\.(?:png|jpg|jpeg|svg|webp|json|csv)"
    r")$"
)


@dataclass(frozen=True)
class Finding:
    path: Path
    line_no: int
    kind: str
    text: str


def is_skipped(path: Path) -> bool:
    rel_parts = path.relative_to(ROOT).parts
    return bool(SKIP_PARTS.intersection(rel_parts) or SKIP_NAME_RE.search(path.name))


def normalize(text: str) -> str:
    return " ".join(text.replace("&nbsp;", " ").split())


def is_probably_user_facing(text: str) -> bool:
    candidate = normalize(text)
    if len(candidate) < 3:
        return False
    if any(token in candidate for token in ("?", "=>", "&&", "||")):
        return False
    if candidate.startswith("[") and candidate.endswith("]"):
        return False
    if "{{" in candidate or "}}" in candidate:
        return False
    if "." in candidate and " " not in candidate and candidate.count(".") >= 2:
        return False
    return not IGNORED_LITERAL_RE.match(candidate)


def scan_file(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return findings

    for line_no, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("import ", "export ", "//", "*")):
            continue
        for regex, kind in (
            (JSX_TEXT_RE, "jsx-text"),
            (PROP_LITERAL_RE, "prop"),
            (OBJECT_LITERAL_RE, "object"),
        ):
            for match in regex.finditer(line):
                text = normalize(match.group(1))
                if is_probably_user_facing(text):
                    findings.append(Finding(path, line_no, kind, text))
    return findings


def scan() -> list[Finding]:
    findings: list[Finding] = []
    for src in FRONTEND_SRC:
        for path in sorted(src.rglob("*")):
            if path.suffix in EXTENSIONS and not is_skipped(path):
                findings.extend(scan_file(path))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fail-on-findings", action="store_true", help="exit non-zero when literals are found")
    parser.add_argument("--limit", type=int, default=80, help="maximum findings to print")
    args = parser.parse_args()

    findings = scan()
    if not findings:
        print("No likely hard-coded UI literals found.")
        return 0

    by_file = Counter(f.path.relative_to(ROOT).as_posix() for f in findings)
    print(f"Found {len(findings)} likely hard-coded UI literals across {len(by_file)} files.")
    print("Top files:")
    for file_name, count in by_file.most_common(12):
        print(f"  {count:4d}  {file_name}")

    print("\nSample findings:")
    for finding in findings[: args.limit]:
        rel = finding.path.relative_to(ROOT)
        print(f"  {rel}:{finding.line_no} [{finding.kind}] {finding.text}")

    if len(findings) > args.limit:
        print(f"  ... {len(findings) - args.limit} more")

    return 1 if args.fail_on_findings else 0


if __name__ == "__main__":
    sys.exit(main())
