"""
Caching decorators and utilities for SQL query results.

This module provides placeholders for tiered caching logic, allowing
endpoints to easily opt-in to result caching via decorators.
"""
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

    Args:
        runtime: The SqlRuntime instance to use for caching.
        tier: The cache tier to use (e.g., 'chart', 'metadata').
        endpoint_hint: A hint for the cache key generation.

    Returns:
        A decorated function that wraps the original with caching logic.
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            # Try to find token in args or kwargs
            _ = _extract_token(func, args, kwargs)
            
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
    """
    Safely extract 'token' from arguments or keyword arguments.

    Args:
        func: The function whose signature to inspect.
        args: Positional arguments passed to the function.
        kwargs: Keyword arguments passed to the function.

    Returns:
        The extracted token as a string, or an empty string if not found.
    """
    token = kwargs.get("token")
    if isinstance(token, str):
        return token
    
    if args and isinstance(args[0], str):
        return args[0]
    
    try:
        sig = inspect.signature(func)
        bound_args = sig.bind(*args, **kwargs)
        token = bound_args.arguments.get("token", "")
        return token if isinstance(token, str) else ""
    except (TypeError, ValueError):
        return ""
