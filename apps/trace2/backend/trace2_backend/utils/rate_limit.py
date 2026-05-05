from shared_api.rate_limit import *  # noqa: F401, F403
from shared_api.rate_limit import RateLimitMiddleware

SlowAPIMiddleware = RateLimitMiddleware
