"""
Shared SlowAPI limiter instance.
Imported by main.py (to attach to app state) and individual routers
(to decorate specific endpoints).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Default: 100 requests per minute per IP for all /api/* routes.
# Individual routes override with stricter limits via @limiter.limit().
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
)
