import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Item, ItemSubmission, User
from app.schemas import ItemCreate, ItemOut, ItemSubmissionCreate, ItemSubmissionOut
from app.routers.auth import get_current_admin, get_current_user

router = APIRouter(prefix="/admin/items", tags=["Admin Items"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads/submissions")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Admin endpoints (JWT admin role required) ─────────────────────────────────

@router.get("/", response_model=list[ItemOut])
def list_all_items(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """ADMIN: List all public items."""
    return db.query(Item).filter(Item.is_public == True).all()


@router.post("/", response_model=ItemOut)
def create_public_item(
    item: ItemCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """ADMIN: Add item to general database."""
    existing = db.query(Item).filter(Item.name == item.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Item '{item.name}' already exists")
    new_item = Item(
        name=item.name,
        category=item.category,
        is_public=True,
        created_by=current_admin.id,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@router.get("/submissions", response_model=list[ItemSubmissionOut])
def list_submissions(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """ADMIN: List all user item submissions with pagination."""
    query = db.query(ItemSubmission)
    if status_filter:
        query = query.filter(ItemSubmission.status == status_filter)
    return query.order_by(ItemSubmission.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/submissions/{item_number}", response_model=ItemSubmissionOut)
def get_submission_by_number(
    item_number: str,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """ADMIN: Get submission by item number (e.g. ITEM-001)."""
    submission = db.query(ItemSubmission).filter(
        ItemSubmission.item_number == item_number
    ).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Submission {item_number} not found")
    return submission


@router.patch("/submissions/{item_number}/approve", response_model=ItemSubmissionOut)
def approve_submission(
    item_number: str,
    admin_notes: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """ADMIN: Approve a submission and create the public item."""
    submission = db.query(ItemSubmission).filter(
        ItemSubmission.item_number == item_number
    ).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Submission {item_number} not found")
    if submission.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Submission already {submission.status}")

    existing_item = db.query(Item).filter(Item.name == submission.name).first()
    if not existing_item:
        new_item = Item(
            name=submission.name,
            category=submission.category,
            is_public=True,
            created_by=current_admin.id,
        )
        db.add(new_item)
        db.flush()

    submission.status = "approved"
    submission.approved_at = datetime.utcnow()
    submission.approved_by = current_admin.id
    submission.admin_notes = admin_notes
    db.commit()
    db.refresh(submission)
    return submission


@router.patch("/submissions/{item_number}/reject", response_model=ItemSubmissionOut)
def reject_submission(
    item_number: str,
    admin_notes: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """ADMIN: Reject a submission with optional notes."""
    submission = db.query(ItemSubmission).filter(
        ItemSubmission.item_number == item_number
    ).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Submission {item_number} not found")
    if submission.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Submission already {submission.status}")
    submission.status = "rejected"
    submission.admin_notes = admin_notes or "Rejected by admin"
    db.commit()
    db.refresh(submission)
    return submission


# ── User submission endpoint ──────────────────────────────────────────────────

router_user = APIRouter(prefix="/items/submit", tags=["User Items"])


def generate_item_number(db: Session) -> str:
    count = db.query(ItemSubmission).count() + 1
    return f"ITEM-{count:03d}"


@router_user.post("/", response_model=ItemSubmissionOut)
async def submit_item(
    name: str = Form(...),
    category: Optional[str] = Form(None),
    price: float = Form(...),
    location: str = Form(...),
    submitter_email: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """USER: Submit a new item for admin approval."""
    if price <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Price must be greater than 0")

    item_number = generate_item_number(db)
    submission_folder = os.path.join(UPLOAD_DIR, item_number)
    os.makedirs(submission_folder, exist_ok=True)

    image_path = None
    if image:
        # Use UUID-based filename to prevent path traversal
        ext = os.path.splitext(image.filename or "")[1].lower()
        safe_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(submission_folder, safe_name)
        try:
            with open(file_path, "wb") as buffer:
                buffer.write(await image.read())
            image_path = file_path
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save image: {str(e)}",
            )

    submission = ItemSubmission(
        item_number=item_number,
        name=name,
        category=category,
        price=price,
        location=location,
        submitter_id=current_user.id,
        submission_folder=submission_folder,
        image_path=image_path,
        status="pending",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router_user.get("/{item_number}")
def get_submission_status(item_number: str, db: Session = Depends(get_db)):
    """USER: Check status of your submission by item number."""
    submission = db.query(ItemSubmission).filter(
        ItemSubmission.item_number == item_number
    ).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Submission {item_number} not found")
    return {
        "item_number": submission.item_number,
        "name": submission.name,
        "status": submission.status,
        "created_at": submission.created_at,
        "approved_at": submission.approved_at,
        "admin_notes": submission.admin_notes,
    }
