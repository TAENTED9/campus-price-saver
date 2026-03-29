# Payments router removed.
# Campify does not process transactions — buyers and sellers connect through messages only.
# See app/routers/storefront.py for the inquiry (messaging) system.
from fastapi import APIRouter
router = APIRouter(prefix="/payments", tags=["Payments"])
