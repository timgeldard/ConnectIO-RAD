"""Application services for user identity queries."""
from processorderhistory_backend.db import run_sql_async

async def get_user_email(token: str) -> str:
    """Fetch the current user's email via Databricks SQL."""
    rows = await run_sql_async(token, "SELECT current_user() AS email", endpoint_hint="poh.me")
    return str(rows[0]["email"]) if rows else ""
