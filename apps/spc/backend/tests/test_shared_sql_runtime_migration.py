import asyncio
from shared_db import SqlRuntime, is_read_only_statement

def test_shared_sql_runtime_supports_spc_audit_hook_and_audit_suppression():
    """Verify that SqlRuntime (shared-db) handles the SPC use case for bypassing audits."""
    calls = []

    async def run_sql(token, statement, **kwargs):
        calls.append(statement)
        if is_read_only_statement(statement):
            return [{"read": sum(1 for c in calls if is_read_only_statement(c))}]
        return [{"write": True}]

    runtime = SqlRuntime(run_sql=run_sql)

    # Initial read
    first_read = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_batch_dim_mv"))
    
    # Write without audit
    asyncio.run(runtime.run_sql_async("token", "INSERT INTO spc_exclusions SELECT 1", audit=False))
    
    # Second read
    second_read = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_batch_dim_mv"))

    assert first_read == [{"read": 1}]
    assert second_read == [{"read": 2}]
    assert len(calls) == 3
