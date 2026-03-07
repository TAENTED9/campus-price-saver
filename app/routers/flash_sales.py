from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import SessionLocal
from app.models import FlashSale, Price, User
from app.schemas import FlashSaleCreate, FlashSaleOut

router = APIRouter(prefix="/flash-sales", tags=["Flash Sales"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _enrich(sale: FlashSale) -> dict:
    """Merge price item details into the sale response dict."""
    d = {
        "id": sale.id,
        "price_id": sale.price_id,
        "seller_id": sale.seller_id,
        "title": sale.title,
        "original_price": sale.original_price,
        "sale_price": sale.sale_price,
        "discount_pct": sale.discount_pct,
        "start_time": sale.start_time,
        "end_time": sale.end_time,
        "is_active": sale.is_active,
        "created_at": sale.created_at,
        "item_name": sale.price_item.name if sale.price_item else None,
        "item_brand": sale.price_item.brand if sale.price_item else None,
        "item_location": sale.price_item.location if sale.price_item else None,
        "item_retailer": sale.price_item.retailer if sale.price_item else None,
    }
    return d


@router.get("/active", response_model=List[FlashSaleOut])
def get_active_flash_sales(
    limit: int = Query(6, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get currently active flash sales (public)"""
    now = datetime.utcnow()
    sales = (
        db.query(FlashSale)
        .filter(
            FlashSale.is_active == True,
            FlashSale.start_time <= now,
            FlashSale.end_time > now,
        )
        .order_by(FlashSale.discount_pct.desc())
        .limit(limit)
        .all()
    )
    return [_enrich(s) for s in sales]


@router.post("/", response_model=FlashSaleOut)
def create_flash_sale(
    sale_in: FlashSaleCreate,
    seller_id: int = Query(..., gt=0, description="Seller user ID"),
    db: Session = Depends(get_db),
):
    """Create a new flash sale on an approved price listing"""
    price = db.query(Price).filter(
        Price.id == sale_in.price_id, Price.status == "approved"
    ).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found or not approved")

    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    if sale_in.end_time <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="end_time must be in the future")

    sale_price = round(price.price * (1 - sale_in.discount_pct / 100), 2)

    sale = FlashSale(
        price_id=sale_in.price_id,
        seller_id=seller_id,
        title=sale_in.title,
        original_price=price.price,
        sale_price=sale_price,
        discount_pct=sale_in.discount_pct,
        end_time=sale_in.end_time,
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return _enrich(sale)


@router.delete("/{sale_id}")
def cancel_flash_sale(
    sale_id: int,
    seller_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    """Cancel / deactivate a flash sale (seller only)"""
    sale = db.query(FlashSale).filter(
        FlashSale.id == sale_id, FlashSale.seller_id == seller_id
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    sale.is_active = False
    db.commit()
    return {"ok": True}
