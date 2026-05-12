"""Application layer for trace2 Genie Assist.

Holds the Genie API client + prompt composer.  Per the DDD architecture
guardrails, this module is the documented exception that may import
``fastapi.HTTPException`` — Genie transport failures map directly onto
HTTP status codes (SSRF allowlist violation -> 500, missing token ->
401, upstream Databricks 4xx -> passthrough).
"""
