# Template Module AI Development Contract

This module follows the SPC/Trace2 bounded-context pattern.

- Keep domain models infrastructure-free.
- Keep application services transport-free.
- Keep routers thin and never import `dal` directly.
- Put Databricks SQL and external IO in `module_template/dal`.
- Use shared-api for FastAPI bootstrap, readiness, auth, error masking, and correlation IDs.
