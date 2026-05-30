"""
Redis cache service. Every helper degrades gracefully: a Redis outage
returns a cache miss rather than crashing the request.

Why the circuit breaker: without it, every request that misses cache pays
the full TCP-connect timeout (multiple seconds on Windows) when Redis is
down. After N consecutive failures we short-circuit for COOLDOWN_S seconds
so the app stays fast in dev environments where Redis isn't running.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Per-operation timeout so a hung Redis never blocks a request for long.
_OP_TIMEOUT_S = 0.25
# Trip the breaker after this many consecutive failures…
_FAIL_THRESHOLD = 2
# …and stop attempting Redis entirely for this long.
_COOLDOWN_S = 30.0

_redis: aioredis.Redis | None = None
_fail_count = 0
_breaker_open_until = 0.0


def _breaker_open() -> bool:
    return time.monotonic() < _breaker_open_until


def _record_failure() -> None:
    global _fail_count, _breaker_open_until
    _fail_count += 1
    if _fail_count >= _FAIL_THRESHOLD:
        _breaker_open_until = time.monotonic() + _COOLDOWN_S
        logger.warning(
            "Redis circuit breaker tripped — disabling cache for %ss",
            int(_COOLDOWN_S),
        )


def _record_success() -> None:
    global _fail_count, _breaker_open_until
    if _fail_count or _breaker_open_until:
        _fail_count = 0
        _breaker_open_until = 0.0


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=_OP_TIMEOUT_S,
            socket_timeout=_OP_TIMEOUT_S,
        )
    return _redis


async def cache_get(key: str) -> Any | None:
    if _breaker_open():
        return None
    try:
        r = await get_redis()
        val = await asyncio.wait_for(r.get(key), timeout=_OP_TIMEOUT_S)
        _record_success()
        return json.loads(val) if val else None
    except Exception:
        _record_failure()
        return None  # Cache miss on error — degrade gracefully


async def cache_set(key: str, value: Any, ttl: int = 60):
    if _breaker_open():
        return
    try:
        r = await get_redis()
        await asyncio.wait_for(
            r.setex(key, ttl, json.dumps(value, default=str)),
            timeout=_OP_TIMEOUT_S,
        )
        _record_success()
    except Exception:
        _record_failure()  # Non-fatal — app works without cache


async def cache_delete(key: str):
    if _breaker_open():
        return
    try:
        r = await get_redis()
        await asyncio.wait_for(r.delete(key), timeout=_OP_TIMEOUT_S)
        _record_success()
    except Exception:
        _record_failure()


async def cache_delete_pattern(pattern: str):
    if _breaker_open():
        return
    try:
        r = await get_redis()
        keys = await asyncio.wait_for(r.keys(f"{pattern}*"), timeout=_OP_TIMEOUT_S)
        if keys:
            await asyncio.wait_for(r.delete(*keys), timeout=_OP_TIMEOUT_S)
        _record_success()
    except Exception:
        _record_failure()


# ── Cache key builders ────────────────────────────────────────────────────
def key_listings_browse(category: str, sort: str, page: int) -> str:
    return f"listings:browse:{category}:{sort}:{page}"


def key_listing_detail(uuid: str) -> str:
    return f"listing:detail:{uuid}"


def key_seller_stats(user_id: int) -> str:
    return f"seller:stats:{user_id}"


def key_seller_storefront(slug: str) -> str:
    return f"storefront:{slug}"


def key_admin_analytics() -> str:
    return "admin:analytics"


def key_flash_sales_active() -> str:
    return "flash_sales:active"


def key_categories() -> str:
    return "items:categories"


def key_platform_stats() -> str:
    return "platform:stats"


def key_user_dashboard_stats(user_id: int) -> str:
    return f"user:dashboard_stats:{user_id}"


# ── Cache TTLs (seconds) ──────────────────────────────────────────────────
TTL = {
    "listings_browse":    60,
    "listing_detail":     120,
    "seller_stats":       30,
    "seller_storefront":  300,
    "admin_analytics":    60,
    "flash_sales_active": 30,
    "categories":         3600,
    "platform_stats":     60,
    "user_dashboard":     30,
}
