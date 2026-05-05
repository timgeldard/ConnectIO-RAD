"""User preferences store — SQLite-backed, filesystem-persistent.

Stores per-user, per-app pinned module lists as a JSON blob.
The SQLite database file is written to PREFS_DB_PATH
(defaults to /tmp/connectio_prefs.db).

Data survives app restarts as long as the host filesystem persists.
For Databricks Apps, the file lives on the ephemeral container disk;
it is lost on instance replacement but preferences are trivially
re-configurable, making this an acceptable trade-off versus
a Unity Catalog table (which would require additional write grants).
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Optional

_DB_PATH: str = os.environ.get("PREFS_DB_PATH", "/tmp/connectio_prefs.db")

_DDL = """
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    app_id  TEXT NOT NULL,
    pinned  TEXT NOT NULL DEFAULT '[]',
    updated TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, app_id)
);
"""


@contextmanager
def _conn():
    """Yield a SQLite connection in WAL mode."""
    con = sqlite3.connect(_DB_PATH, check_same_thread=False, timeout=5)
    con.execute("PRAGMA journal_mode=WAL")
    try:
        yield con
    finally:
        con.close()


def _ensure_schema() -> None:
    """Create the preferences table if it does not exist."""
    with _conn() as con:
        con.execute(_DDL)
        con.commit()


_ensure_schema()


def get_pinned(user_id: str, app_id: str) -> Optional[list[str]]:
    """Return the pinned module list for (user, app).

    Returns None when the user has no saved record, signalling
    the shell to show all modules (factory-default view).
    """
    with _conn() as con:
        row = con.execute(
            "SELECT pinned FROM user_preferences WHERE user_id = ? AND app_id = ?",
            (user_id, app_id),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row[0])


def set_pinned(user_id: str, app_id: str, pinned: list[str]) -> None:
    """Upsert the pinned module list for (user, app)."""
    payload = json.dumps(pinned)
    with _conn() as con:
        con.execute(
            """
            INSERT INTO user_preferences (user_id, app_id, pinned)
            VALUES (?, ?, ?)
            ON CONFLICT (user_id, app_id) DO UPDATE
              SET pinned  = excluded.pinned,
                  updated = datetime('now')
            """,
            (user_id, app_id, payload),
        )
        con.commit()
