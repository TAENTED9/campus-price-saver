"""
Redis cache service. Every helper degrades gracefully: a Redis outage
returns a cache miss rather than crashing the request.
"""

import redis.asyncio as aioredis
import json
import os
from typing import Any

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _redis


async def cache_get(key: str) -> Any | None:
    try:
        r = await get_redis()
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None  # Cache miss on error — degrade gracefully


async def cache_set(key: str, value: Any, ttl: int = 60):
    try:
        r = await get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass  # Non-fatal — app works without cache


async def cache_delete(key: str):
    try:
        r = await get_redis()
        await r.delete(key)
    except Exception:
        pass


async def cache_delete_pattern(pattern: str):
    try:
        r = await get_redis()
        keys = await r.keys(f"{pattern}*")
        if keys:
            await r.delete(*keys)
    except Exception:
        pass


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
