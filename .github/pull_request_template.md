## Summary

<!-- One or two sentences: what changed and why. -->

## Why

<!-- The problem this fixes or the capability it adds. Link issue/incident if relevant. -->

## Test plan

<!-- How you verified this works. Commands run, endpoints hit, screenshots if UI. -->

- [ ]
- [ ]

## Risk / rollback

<!-- What breaks if this is wrong, and how to revert. -->

## Pre-flight checklist

- [ ] Tests added or updated for changed behaviour.
- [ ] Coverage gates still green locally.
- [ ] Inline docs updated (PEP 257 for Python, JSDoc for TS).
- [ ] **Wheel-bundled package?** If you touched `libs/*` or `apps/*/backend/`, bumped the matching `pyproject.toml` version (otherwise pip skips the reinstall on deploy — see `docs/architecture/review-2026-05-07.md`).
- [ ] External docs / `/docs` updated if architecture or API changed.

## Related work

<!-- Links to prior PRs, ADRs, plans, or follow-ups this enables. -->
