"""
APScheduler — weekly seller email reports.
Runs every Monday at 08:00 WAT (UTC+1 → UTC 07:00).
"""
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func

from app.database import SessionLocal
from app.models import User, Price, Inquiry
from app.services.email import send_weekly_report

scheduler = AsyncIOScheduler(timezone="Africa/Lagos")


@scheduler.scheduled_job("cron", day_of_week="mon", hour=8, minute=0)
def weekly_seller_reports():
    db = SessionLocal()
    try:
        sellers = db.query(User).filter(User.role == "seller").all()
        week_ago = datetime.utcnow() - timedelta(days=7)
        for seller in sellers:
            if not seller.email:
                continue
            listing_ids = [
                row[0]
                for row in db.query(Price.id).filter(Price.submitted_by == seller.id).all()
            ]
            views = (
                db.query(func.sum(Price.view_count))
                .filter(Price.submitted_by == seller.id)
                .scalar()
                or 0
            )
            inquiries = (
                db.query(func.count(Inquiry.id))
                .filter(
                    Inquiry.seller_id == seller.id,
                    Inquiry.created_at >= week_ago,
                )
                .scalar()
                or 0
            ) if listing_ids else 0
            send_weekly_report(
                seller.email,
                seller.display_name or seller.username or "Seller",
                {"views": int(views), "inquiries": int(inquiries)},
            )
    finally:
        db.close()
