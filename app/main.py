import os
import json
import time
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Set
from contextlib import asynccontextmanager


from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.websockets import WebSocket
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from app.limiter import limiter
from app.config import settings as _app_settings
from app.routers import (
    items, prices, ml, pending, stores,
    admin_items, auth, google_maps, compare, admin_stats,
    flash_sales, seller, seller_orders, admin_users, uploads, storefront,
    reviews, wishlist, notifications, listings, messages,
)
from app.routers.settings import router as settings_router
from app.database import init_db, SessionLocal
from app.models import Category, User
from app.routers.auth import decode_access_token

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
_LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)

_fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")

_file_handler = RotatingFileHandler(
    _LOG_DIR / "app.log",
    maxBytes=10 * 1024 * 1024,  # 10 MB per file
    backupCount=5,
    encoding="utf-8",
)
_file_handler.setFormatter(_fmt)

_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(_fmt)

logging.basicConfig(
    level=logging.INFO,
    handlers=[_file_handler, _stream_handler],
)
logger = logging.getLogger("campify")


# ── WebSocket broadcaster ─────────────────────────────────────────────────────
class PriceUpdater:
    """Simple in-memory broadcaster for real-time price updates."""
    def __init__(self):
        self.subscribers: Set[WebSocket] = set()

    async def subscribe(self, websocket: WebSocket):
        await websocket.accept()
        self.subscribers.add(websocket)

    async def unsubscribe(self, websocket: WebSocket):
        self.subscribers.discard(websocket)

    async def broadcast(self, message: dict):
        payload = json.dumps(message)
        dead: Set[WebSocket] = set()
        for ws in self.subscribers:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.error(f"WebSocket broadcast error: {e}")
                dead.add(ws)
        for ws in dead:
            await self.unsubscribe(ws)


price_updater = PriceUpdater()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    messages.ensure_message_tables()
    db = SessionLocal()
    if db.query(Category).count() == 0:
        seed_categories(db)
    db.close()
    # Scheduled jobs are owned by Celery beat (see app/celery_app.py).
    logger.info("Backend started successfully!")
    yield


def seed_categories(db):
    categories_data = [
        {"name": "Food & Groceries",      "description": "Rice, bread, noodles, eggs, meat, fruits, vegetables, snacks, condiments"},
        {"name": "Drinks & Beverages",    "description": "Water, juice, soda, milk, sachet water, energy drinks, tea, coffee"},
        {"name": "Fashion & Clothing",    "description": "Clothes, shoes, bags, belts, hats, jewelry, accessories, wristwatches"},
        {"name": "Tech & Gadgets",        "description": "Phones, chargers, cables, earphones, power banks, laptops, accessories"},
        {"name": "Books & Stationery",    "description": "Textbooks, notebooks, pens, calculators, printed notes, highlighters"},
        {"name": "Beauty & Personal Care","description": "Skincare, haircare, soap, deodorant, perfume, makeup, toiletries"},
        {"name": "Services & Skills",     "description": "Tutoring, printing, laundry, design, photography, repairs, coding help"},
    ]
    for cat_data in categories_data:
        db.add(Category(**cat_data))
    db.commit()
    logger.info("✅ 7 categories seeded!")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Campify API", version="1.0.0", lifespan=lifespan)

# ── Rate limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait before trying again."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"[422] {request.method} {request.url} — {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


# ── Block 12B: HTTPS redirect middleware (production only) ────────────────
if _app_settings.IS_PRODUCTION:
    from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

# ── Block 12C: Security headers (+ HSTS in production) ────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if _app_settings.IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    return response


# ── Request logging ───────────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    return response


# ── CORS ──────────────────────────────────────────────────────────────────────
# Production:  ALLOWED_ORIGINS=https://campify.ng,https://www.campify.ng
# Development: localhost + dev LAN IP are added automatically.
# FIX #2: never allow localhost via regex in production.
_PROD_ORIGINS = ["https://campify.ng", "https://www.campify.ng"]
_DEV_ORIGINS  = _PROD_ORIGINS + [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.0.195:3000",
]

_env_origins = os.getenv("ALLOWED_ORIGINS")
if _env_origins:
    ALLOWED_ORIGINS = [o.strip() for o in _env_origins.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = _PROD_ORIGINS if _app_settings.IS_PRODUCTION else _DEV_ORIGINS

_cors_kwargs = dict(
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)
if not _app_settings.IS_PRODUCTION:
    _cors_kwargs["allow_origin_regex"] = r"http://(localhost|127\.0\.0\.1|192\.168\.0\.195):\d+"

app.add_middleware(CORSMiddleware, **_cors_kwargs)


# ── Inject price_updater into prices router ───────────────────────────────────
from app.routers.prices import set_price_updater
set_price_updater(price_updater)


# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(items.router,             prefix="/api")
app.include_router(prices.router,            prefix="/api")
app.include_router(pending.router,           prefix="/api")
app.include_router(ml.router,               prefix="/api")
app.include_router(stores.router,            prefix="/api")
app.include_router(admin_items.router,       prefix="/api")
app.include_router(admin_items.router_user,  prefix="/api")
app.include_router(auth.router,              prefix="/api")
app.include_router(google_maps.router,       prefix="/api")
app.include_router(compare.router,           prefix="/api")
app.include_router(admin_stats.router,       prefix="/api")
app.include_router(flash_sales.router,       prefix="/api")
app.include_router(seller.router,                   prefix="/api")
app.include_router(seller_orders.orders_router,     prefix="/api")
app.include_router(admin_users.router,       prefix="/api")
app.include_router(uploads.router,           prefix="/api")
app.include_router(storefront.router,        prefix="/api")
app.include_router(reviews.router,           prefix="/api")
app.include_router(wishlist.router,          prefix="/api")
app.include_router(notifications.router,     prefix="/api")
app.include_router(listings.router,          prefix="/api")
app.include_router(messages.router,          prefix="/api")
app.include_router(settings_router)


# ── Block 14C: Health check ───────────────────────────────────────────────────
@app.get("/api/health", include_in_schema=False)
async def health_check():
    return {"status": "ok", "service": "campify-api"}


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Serve legacy HTML frontend (dev only) ────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

if not FRONTEND_DIR.exists():
    ROOT_FRONTEND = BASE_DIR.parent / "frontend"
    FRONTEND_DIR = ROOT_FRONTEND if ROOT_FRONTEND.exists() else BASE_DIR

if FRONTEND_DIR.exists():
    css_dir = FRONTEND_DIR / "css"
    js_dir  = FRONTEND_DIR / "js"
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_root():
        index_path = FRONTEND_DIR / "index.html"
        return FileResponse(index_path) if index_path.exists() else {"message": "Frontend not found"}

    @app.get("/login.html", include_in_schema=False)
    async def serve_login():
        p = FRONTEND_DIR / "login.html"
        return FileResponse(p) if p.exists() else {"error": "File not found"}

    @app.get("/user-dashboard.html", include_in_schema=False)
    async def serve_user_dashboard():
        p = FRONTEND_DIR / "user-dashboard.html"
        return FileResponse(p) if p.exists() else {"error": "File not found"}

    @app.get("/admin-dashboard.html", include_in_schema=False)
    async def serve_admin_dashboard():
        p = FRONTEND_DIR / "admin-dashboard.html"
        return FileResponse(p) if p.exists() else {"error": "File not found"}

    @app.get("/basket-compare.html", include_in_schema=False)
    async def serve_basket_compare():
        p = FRONTEND_DIR / "basket-compare.html"
        return FileResponse(p) if p.exists() else {"error": "File not found"}

    @app.get("/search.html", include_in_schema=False)
    async def serve_search():
        p = FRONTEND_DIR / "search.html"
        return FileResponse(p) if p.exists() else {"error": "File not found"}

    @app.get("/product.html", include_in_schema=False)
    async def serve_product():
        p = FRONTEND_DIR / "product.html"
        return FileResponse(p) if p.exists() else {"error": "File not found"}

    @app.get("/map", include_in_schema=False)
    async def serve_map():
        p = FRONTEND_DIR / "map.html"
        return FileResponse(p) if p.exists() else {"message": "Map page not yet implemented"}


# ── Per-conversation chat room manager ─────────────────────────────────────────
from app.chat_manager import chat_manager as _chat_manager


# ── WebSocket — real-time chat ──────────────────────────────────────────────
@app.websocket("/ws/chat/{conversation_uuid}")
async def websocket_chat_endpoint(websocket: WebSocket, conversation_uuid: str):
    """
    Real-time chat endpoint.
    Both participants connect here; messages are broadcast to the full room.
    Token passed as query param: /ws/chat/{id}?token=<jwt>
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    # Verify token — supports both uid (new) and sub (legacy) payload fields
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("uid") or payload.get("sub", 0))
        if not user_id:
            raise ValueError("no user id in token")
    except Exception:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4001)
            return

        from app.routers.messages import Conversation, DirectMessage
        from datetime import datetime as _dt

        # Resolve conversation (URL param is always a numeric id as string)
        conv: Conversation | None = None
        try:
            cid = int(conversation_uuid)
            conv = db.query(Conversation).filter(Conversation.id == cid).first()
        except ValueError:
            pass

        if not conv or user_id not in (conv.user_a_id, conv.user_b_id):
            await websocket.close(code=4003)
            return

        await websocket.accept()
        _chat_manager.join(websocket, conv.id)
        logger.info(f"WS chat: user {user_id} joined conversation {conv.id}")

        try:
            while True:
                raw = await websocket.receive_text()
                if raw == "ping":
                    await websocket.send_text("pong")
                    continue

                try:
                    data = json.loads(raw)
                except Exception:
                    continue

                # Handle typed events (typing indicators)
                event_type = data.get("type")
                if event_type == "typing_start":
                    await _chat_manager.broadcast(conv.id, json.dumps({
                        "type": "typing_start",
                        "conversation_id": conv.id,
                        "user_id": user_id,
                    }), exclude=websocket)
                    continue
                if event_type == "typing_stop":
                    await _chat_manager.broadcast(conv.id, json.dumps({
                        "type": "typing_stop",
                        "conversation_id": conv.id,
                        "user_id": user_id,
                    }), exclude=websocket)
                    continue

                content = (data.get("content") or "").strip()
                if not content or len(content) > 4000:
                    continue

                msg = DirectMessage(
                    conversation_id=conv.id,
                    sender_id=user_id,
                    content=content,
                )
                db.add(msg)
                conv.last_message_at = _dt.utcnow()
                conv.last_message_preview = content[:200]
                db.commit()
                db.refresh(msg)

                outbound = json.dumps({
                    "id": msg.id,
                    "conversation_uuid": str(conv.id),
                    "sender_id": user_id,
                    "content": content,
                    "created_at": msg.created_at.isoformat(),
                    "is_read": False,
                })
                # Broadcast to BOTH participants (sender + receiver)
                await _chat_manager.broadcast(conv.id, outbound)
        except Exception as e:
            logger.info(f"WS chat closed for user {user_id}: {e}")
        finally:
            _chat_manager.leave(websocket, conv.id)
    finally:
        db.close()


# ── WebSocket — real-time price updates ──────────────────────────────────────
@app.websocket("/ws/prices")
async def websocket_prices_endpoint(websocket: WebSocket):
    await price_updater.subscribe(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await price_updater.unsubscribe(websocket)


# ── SSE — browser-compatible fallback ────────────────────────────────────────
@app.get("/api/prices/stream", include_in_schema=False)
async def stream_prices():
    async def event_generator():
        yield 'data: {"message": "Connected to price stream"}\n\n'
    return StreamingResponse(event_generator(), media_type="text/event-stream")
