import os
import json
import time
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.websockets import WebSocket
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from app.limiter import limiter
from app.scheduler import scheduler
from app.routers import (
    items, prices, ml, pending, stores,
    admin_items, auth, google_maps, compare, admin_stats,
    flash_sales, seller, admin_users, uploads, storefront,
    reviews, wishlist, notifications,
)
from app.database import init_db, SessionLocal
from app.models import Category

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
    db = SessionLocal()
    if db.query(Category).count() == 0:
        seed_categories(db)
    db.close()
    scheduler.start()
    logger.info("Backend started successfully!")
    yield
    scheduler.shutdown(wait=False)


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


# ── Security headers ──────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
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
# Production: set ALLOWED_ORIGINS=https://campify.ng,https://www.campify.ng
# Do NOT include localhost in the production env var.
_default_origins = "https://campify.ng,https://www.campify.ng,http://localhost:3000"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


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
app.include_router(seller.router,            prefix="/api")
app.include_router(seller.orders_router,     prefix="/api")
app.include_router(admin_users.router,       prefix="/api")
app.include_router(uploads.router,           prefix="/api")
app.include_router(storefront.router,        prefix="/api")
app.include_router(reviews.router,           prefix="/api")
app.include_router(wishlist.router,          prefix="/api")
app.include_router(notifications.router,     prefix="/api")


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
