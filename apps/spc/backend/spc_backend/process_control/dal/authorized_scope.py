"""Authorized plant scope — SPC-native implementation.

Queries ``gold_plant`` via ``spc_backend.utils.db.run_sql_async`` so the call
benefits from SPC's 15-minute metadata cache (``gold_plant`` is listed in
``_METADATA_CACHE_PATTERNS``) and the query audit hook.

Unity Catalog's token-passthrough model means the query executes as the calling
user; if row-level security is applied to ``gold_plant`` the result is already
scoped to what that user can see.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from spc_backend.utils.db import run_sql_async, tbl


async def fetch_authorized_plants(token: str) -> list[str]:
    """Return plant IDs the calling user is authorized to see.

    Args:
        token: Databricks access token forwarded from the proxy header.

    Returns:
        Sorted list of PLANT_ID strings the caller can access.  Empty list means
        the user has no visible plants.
    """
    sql = f"SELECT DISTINCT PLANT_ID FROM {tbl('gold_plant')} ORDER BY PLANT_ID"
    rows = await run_sql_async(token, sql, endpoint_hint="spc.authorized_scope")
    return sorted(str(r["PLANT_ID"]) for r in rows if r.get("PLANT_ID"))


async def assert_plant_authorized(token: str, plant_id: Optional[str]) -> None:
    """Raise HTTP 403 if plant_id is not in the caller's authorized scope.

    No-op when plant_id is None (global scope — results are filtered by the SQL
    WHERE clause in each DAL query).
    """
    if plant_id is None:
        return
    authorized = await fetch_authorized_plants(token)
    if plant_id not in authorized:
        raise HTTPException(
            status_code=403,
            detail=f"Plant '{plant_id}' is not in your authorized scope.",
        )
