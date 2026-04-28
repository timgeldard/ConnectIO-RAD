from __future__ import annotations

import functools
import inspect
from collections.abc import Callable
from typing import Any, Optional, TypeVar, cast

from shared_db.runtime import SqlRuntime

F = TypeVar("F", bound=Callable[..., Any])


def cached_query(
    *,
    runtime: Optional[SqlRuntime] = None,
    tier: str = "chart",
    endpoint_hint: str = "cached.query",
) -> Callable[[F], F]:
    """
    Decorator to cache a SQL-executing function using SqlRuntime tiered caching.
    
    The decorated function must accept a 'token' as its first argument or 
    provide it via a keyword argument.
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            # Try to find token in args or kwargs
            token = _extract_token(func, args, kwargs)
            
            # If we have a runtime and a token, we can use the runtime's cache
            # But wait, SqlRuntime.run_sql_async already handles caching!
            # This decorator is useful if the function itself builds the SQL 
            # and we want to cache the whole function call.
            
            # For now, this is a placeholder for more complex caching logic 
            # or for functions that don't directly call run_sql_async but 
            # we still want to cache their results.
            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            return func(*args, **kwargs)

        if inspect.iscoroutinefunction(func):
            return cast(F, async_wrapper)
        return cast(F, sync_wrapper)

    return decorator


def _extract_token(func: Callable, args: tuple, kwargs: dict) -> str:
    if "token" in kwargs:
        return kwargs["token"]
    if args:
        return args[0]
    
    # Try to find 'token' in the function signature defaults or arguments
    sig = inspect.signature(func)
    bound_args = sig.bind(*args, **kwargs)
    return bound_args.arguments.get("token", "")
