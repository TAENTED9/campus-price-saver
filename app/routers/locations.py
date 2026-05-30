"""
GET /api/locations — public read-only endpoint that returns the canonical
5-zone UNILAG pickup hierarchy. The frontend caches the response and uses it
to render the seller picker, listing-detail display, and homepage filter.

The data is static (defined in app.constants.locations), so this endpoint
is cheap to call. It's intentionally unauthenticated.
"""
from fastapi import APIRouter

from app.constants.locations import get_location_tree

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("")
async def list_locations() -> dict:
    """
    Returns the canonical UNILAG pickup-location hierarchy.

    Response shape:
        {
          "groups": [
            {
              "key": "main_gate_front_campus",
              "name": "Main Gate & Front Campus Zone",
              "children": ["Faculty of Environmental Sciences", ...]
            },
            ...
          ]
        }
    """
    return {"groups": get_location_tree()}
