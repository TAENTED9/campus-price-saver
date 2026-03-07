from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Store, Price
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/stores", tags=["Stores"])


class StoreResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    class Config:
        from_attributes = True


class StoreWithListings(StoreResponse):
    listing_count: int = 0


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[StoreResponse])
def get_all_stores(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get all stores (public)"""
    return db.query(Store).limit(limit).all()


@router.get("/nearby", response_model=List[StoreWithListings])
def get_nearby_stores(
    location: str = Query("", description="Hostel name or area to filter by"),
    limit: int = Query(6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """
    Get stores near a campus location (hostel / area name).
    Matches against store name and address fields.
    """
    query = db.query(Store)
    loc = location.strip()
    if loc:
        pattern = f"%{loc}%"
        query = query.filter(
            or_(Store.name.ilike(pattern), Store.address.ilike(pattern))
        )
    stores = query.limit(limit).all()

    result = []
    for store in stores:
        count = db.query(Price).filter(
            Price.store_id == store.id, Price.status == "approved"
        ).count()
        result.append(
            StoreWithListings(
                id=store.id,
                name=store.name,
                address=store.address,
                lat=store.lat,
                lng=store.lng,
                listing_count=count,
            )
        )
    return result


@router.get("/search", response_model=List[StoreResponse])
def search_stores(
    q: str,
    db: Session = Depends(get_db),
):
    """Search stores by name (public)"""
    return db.query(Store).filter(Store.name.ilike(f"%{q}%")).all()


@router.post("/", response_model=StoreResponse)
def create_store(
    name: str,
    lat: float,
    lng: float,
    address: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Create a new store"""
    new_store = Store(name=name, lat=lat, lng=lng, address=address)
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store
