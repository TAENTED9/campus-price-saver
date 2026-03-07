from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routers import items, prices, payments, ml, pending, stores, admin_items, auth, google_maps, compare, admin_stats, flash_sales, seller, admin_users, uploads, storefront, reviews, wishlist, notifications
from app.database import init_db, SessionLocal
from app.models import Category
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from pathlib import Path
import json
from typing import Set
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"

# WebSocket broadcaster (simple in-memory solution)
class PriceUpdater:
    """Simple broadcaster for price updates without external dependencies"""
    def __init__(self):
        self.subscribers: Set[WebSocket] = set()
    
    async def subscribe(self, websocket: WebSocket):
        await websocket.accept()
        self.subscribers.add(websocket)
    
    async def unsubscribe(self, websocket: WebSocket):
        self.subscribers.discard(websocket)
    
    async def broadcast(self, message: dict):
        """Broadcast price update to all connected clients"""
        payload = json.dumps(message)
        dead_connections = set()
        
        for websocket in self.subscribers:
            try:
                await websocket.send_text(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                dead_connections.add(websocket)
        
        # Clean up dead connections
        for ws in dead_connections:
            await self.unsubscribe(ws)

price_updater = PriceUpdater()

# ------------------------------
# Lifespan: DB init + seed
# ------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    
    db = SessionLocal()
    if db.query(Category).count() == 0:
        seed_categories(db)
    db.close()
    
    print("Backend started successfully!")
    yield


def seed_categories(db):
    categories_data = [
        {
            "name": "Food & Groceries",
            "description": "Rice, bread, noodles, eggs, meat, fruits, vegetables, snacks, condiments"
        },
        {
            "name": "Drinks & Beverages",
            "description": "Water, juice, soda, milk, sachet water, energy drinks, tea, coffee"
        },
        {
            "name": "Fashion & Clothing",
            "description": "Clothes, shoes, bags, belts, hats, jewelry, accessories, wristwatches"
        },
        {
            "name": "Tech & Gadgets",
            "description": "Phones, chargers, cables, earphones, power banks, laptops, accessories"
        },
        {
            "name": "Books & Stationery",
            "description": "Textbooks, notebooks, pens, calculators, printed notes, highlighters"
        },
        {
            "name": "Beauty & Personal Care",
            "description": "Skincare, haircare, soap, deodorant, perfume, makeup, toiletries"
        },
        {
            "name": "Services & Skills",
            "description": "Tutoring, printing, laundry, design, photography, repairs, coding help"
        },
    ]

    for cat_data in categories_data:
        category = Category(**cat_data)
        db.add(category)

    db.commit()
    print("✅ 7 categories seeded!")


# ------------------------------
# FastAPI App
# ------------------------------
app = FastAPI(title="Campify API", version="1.0.0", lifespan=lifespan)

# Add rate limiter exception handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please try again later.",
            "retry_after": 60
        }
    )

# Add rate limiter to app state
if RATE_LIMIT_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)

# Inject price_updater into prices router
from app.routers.prices import set_price_updater
set_price_updater(price_updater)

# ------------------------------
# CORS
# ------------------------------
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Change from ["*"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)


# ------------------------------
# API Routers (/api)
# ------------------------------
app.include_router(items.router, prefix="/api")
app.include_router(prices.router, prefix="/api")
app.include_router(pending.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(ml.router, prefix="/api")
app.include_router(stores.router, prefix="/api")
app.include_router(admin_items.router, prefix="/api")
app.include_router(admin_items.router_user, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(google_maps.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(admin_stats.router, prefix="/api")
app.include_router(flash_sales.router, prefix="/api")
app.include_router(seller.router, prefix="/api")
app.include_router(admin_users.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(storefront.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(wishlist.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")

# ------------------------------
# Serve Frontend (STATIC + HTML)
# ------------------------------
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent              # backend/app
FRONTEND_DIR = BASE_DIR / "frontend"                    # backend/app/frontend

# Check if frontend directory exists, if not, try root level
if not FRONTEND_DIR.exists():
    # Try parent directory (if frontend was moved to backend/frontend)
    ROOT_FRONTEND = BASE_DIR.parent / "frontend"
    if ROOT_FRONTEND.exists():
        FRONTEND_DIR = ROOT_FRONTEND
    else:
        # Try current directory as fallback
        FRONTEND_DIR = BASE_DIR

# 1) Serve static files correctly (only if directory exists)
if FRONTEND_DIR.exists():
    # Mount CSS and JS directories at root level for proper relative path resolution
    css_dir = FRONTEND_DIR / "css"
    js_dir = FRONTEND_DIR / "js"
    
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")
    
    # Also mount full static folder as fallback
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    
    # 2) Serve index.html as home page
    @app.get("/", include_in_schema=False)
    async def serve_root():
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"message": "Frontend files not found"}

    # Serve login page
    @app.get("/login.html", include_in_schema=False)
    async def serve_login():
        login_path = FRONTEND_DIR / "login.html"
        if login_path.exists():
            return FileResponse(login_path)
        return {"error": "File not found"}
    
    # Serve other HTML files
    @app.get("/user-dashboard.html", include_in_schema=False)
    async def serve_user_dashboard():
        dashboard_path = FRONTEND_DIR / "user-dashboard.html"
        if dashboard_path.exists():
            return FileResponse(dashboard_path)
        return {"error": "File not found"}
    
    @app.get("/admin-dashboard.html", include_in_schema=False)
    async def serve_admin_dashboard():
        dashboard_path = FRONTEND_DIR / "admin-dashboard.html"
        if dashboard_path.exists():
            return FileResponse(dashboard_path)
        return {"error": "File not found"}

    @app.get("/basket-compare.html", include_in_schema=False)
    async def serve_basket_compare():
        dashboard_path = FRONTEND_DIR / "basket-compare.html"
        if dashboard_path.exists():
            return FileResponse(dashboard_path)
        return {"error": "File not found"}
    
    # Serve public pages
    @app.get("/search.html", include_in_schema=False)
    async def serve_search():
        search_path = FRONTEND_DIR / "search.html"
        if search_path.exists():
            return FileResponse(search_path)
        return {"error": "File not found"}
    
    @app.get("/product.html", include_in_schema=False)
    async def serve_product():
        product_path = FRONTEND_DIR / "product.html"
        if product_path.exists():
            return FileResponse(product_path)
        return {"error": "File not found"}
    
    @app.get("/map", include_in_schema=False)
    async def serve_map():
        # Redirect to map.html if it exists, otherwise return error
        map_path = FRONTEND_DIR / "map.html"
        if map_path.exists():
            return FileResponse(map_path)
        return {"message": "Map page not yet implemented"}

# ========== WEBSOCKET FOR REAL-TIME PRICE UPDATES ==========
@app.websocket("/ws/prices")
async def websocket_prices_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time price updates.
    
    Clients subscribe to this endpoint to receive live price update notifications.
    When a new price is submitted, all connected clients are notified.
    
    Message format:
    {
        "type": "price_update",
        "item_id": 1,
        "item_name": "Rice",
        "store_name": "Shop A",
        "price": 5000,
        "timestamp": "2024-02-03T10:30:00Z"
    }
    """
    await price_updater.subscribe(websocket)
    try:
        while True:
            # Keep connection alive and listen for client messages
            data = await websocket.receive_text()
            # Could implement client-side subscriptions/filters here if needed
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await price_updater.unsubscribe(websocket)

# ========== PUBLIC API ENDPOINT FOR PRICE UPDATES ==========
@app.get("/api/prices/stream", include_in_schema=False)
async def stream_prices():
    """Server-Sent Events (SSE) endpoint for real-time price updates.
    Better browser compatibility than WebSockets.
    
    Usage:
    const eventSource = new EventSource('/api/prices/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Price update:', data);
    };
    """
    async def event_generator():
        # This would need to be implemented with actual event streaming
        # For now, return a simple placeholder
        yield "data: {\"message\": \"Connected to price stream\"}\n\n"
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(event_generator(), media_type="text/event-stream")
