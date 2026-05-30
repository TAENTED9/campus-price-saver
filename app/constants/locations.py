"""
Canonical UNILAG delivery / meetup locations.

This module is the single source of truth for every place a seller can
offer a pickup at and a buyer can choose to meet at. The database stores
location strings exactly as they appear in CHILDREN below; the frontend
fetches the same tree via GET /api/locations so the two stay in sync.

Adding or renaming a location:
  1. Edit LOCATION_GROUPS below.
  2. Restart the API — the GET /api/locations response refreshes
     automatically (no migration needed; locations are not in the DB).
  3. Existing listings with the old name will no longer validate on
     save. Decide whether to add the old name to OLD_LOCATIONS_TO_PURGE.
"""

from __future__ import annotations

from typing import Dict, List, Tuple


# ── 5-zone canonical hierarchy (no overlaps, parent-child is 1:N) ────────
# Order here is the order shown in the UI.
LOCATION_GROUPS: List[Dict[str, object]] = [
    {
        "key": "main_gate_front_campus",
        "name": "Main Gate & Front Campus Zone",
        "children": [
            "Faculty of Environmental Sciences",
            "Sports Centre Main Gate",
            "Sports Centre Shades",
            "UNILAG Main Shopping Complex",
            "UBA Green Park",
            "Education Block Entrance",
        ],
    },
    {
        "key": "main_campus_central_hub",
        "name": "Main Campus Central Hub (Arts, Jaja & Admin)",
        "children": [
            "Faculty of Engineering (Main Block)",
            "Faculty of Arts (The Quadrangle)",
            "Love Garden (Near Arts Faculty)",
            "Faculty of Law Annex",
            "Jaja Hall Frontage",
            "Jaja Hall Basket Ball Court Area",
            "Main Library Front Desk / Steps",
            "CITS Building Car Park",
            "Senate Building",
            "Sofoluwe Park Charging Points",
        ],
    },
    {
        "key": "science_social_commercial_hub",
        "name": "Science, Social Sciences & Commercial Hub",
        "children": [
            "Faculty of Science (Buka Area)",
            "Faculty of Science Quadrangle",
            "Faculty of Social Sciences (FSS) Car Park",
            "Social Sciences (FSS) Food Court",
            "Management Sciences (FMS) Corridor",
            "Amala Spot (Iya Moria) Sitting Area",
        ],
    },
    {
        "key": "new_hall_moremi_complex",
        "name": "New Hall & Moremi Complex (Main Hostel Area)",
        "children": [
            "New Hall Gate",
            "New Hall Cafeteria Entrance",
            "New Hall Quadrangle",
            "Moremi Hall",
            "Moremi Hall Car Park",
            "Madam Tinubu Hall (MTH) Gate",
            "Biobaku Hall Gate",
            "Highrise Cafeteria Frontage",
        ],
    },
    {
        "key": "lagoon_auditorium_zone",
        "name": "Lagoon Front & Auditorium Zone (Back Campus/Waterfront)",
        "children": [
            "The Lagoon Front (Main Gate Area)",
            "Distance Learning Institute (DLI)",
            "Akintunde Ojo Main Auditorium",
            "Main Auditorium Front Courtyard",
            "Aminu Kano Hall Gate",
            "UNILAG Health Centre (Medical Centre)",
        ],
    },
]


# ── Derived lookups (computed once at import time) ───────────────────────

ALL_LOCATIONS: Tuple[str, ...] = tuple(
    child for group in LOCATION_GROUPS for child in group["children"]  # type: ignore[index]
)
"""Flat tuple of every canonical child location, in display order."""


LOCATION_SET: frozenset[str] = frozenset(ALL_LOCATIONS)
"""O(1) membership check — use this for validation."""


LOCATION_TO_GROUP: Dict[str, str] = {
    child: group["key"]  # type: ignore[assignment]
    for group in LOCATION_GROUPS
    for child in group["children"]  # type: ignore[index]
}
"""child location -> parent group key. Used for grouping display chips."""


GROUP_KEY_TO_NAME: Dict[str, str] = {
    group["key"]: group["name"]  # type: ignore[index, assignment]
    for group in LOCATION_GROUPS
}


# ── Legacy values that must be purged from existing listings ─────────────
# These are the hardcoded values from the old frontend `MEETUP_SPOTS`
# array plus any free-text values we know are not real UNILAG spots.
# Sub-block 1B's startup migration uses this set to identify listings
# that need to be auto-blocked until the seller updates them.
OLD_LOCATIONS_TO_PURGE: frozenset[str] = frozenset({
    "GTBank bus stop",
    "Moremi Hall gate",          # superseded by "Moremi Hall Car Park"
    "Faculty of Science gate",   # superseded by faculty entries in zone 3
    "University Senate building",  # superseded by "Senate Building"
    "Amina Hall",                # not a real UNILAG hall
    "Kuti Hall",                 # not a real UNILAG hall
    "Angola",
    "Nithub",                    # explicitly removed by product owner
    "NIThub",
    "NIthub",
    "New Hall",                  # ambiguous — superseded by New Hall Gate/Quadrangle/Cafeteria Entrance
    "Freedom Park",
})


def validate_locations(values: List[str]) -> List[str]:
    """
    Normalise and validate a list of seller-selected locations.

    Returns the deduped list in canonical display order.
    Raises ValueError if any entry is not in LOCATION_SET.
    """
    if not isinstance(values, list):
        raise ValueError("locations must be a list of strings")
    seen: set[str] = set()
    cleaned: List[str] = []
    for raw in values:
        if not isinstance(raw, str):
            raise ValueError("each location must be a string")
        name = raw.strip()
        if not name:
            continue
        if name not in LOCATION_SET:
            raise ValueError(f"Unknown location: {name!r}")
        if name in seen:
            continue
        seen.add(name)
        cleaned.append(name)
    # Sort by canonical display order so persistence is deterministic
    order = {n: i for i, n in enumerate(ALL_LOCATIONS)}
    cleaned.sort(key=lambda n: order[n])
    return cleaned


def is_legacy_location(value: str | None) -> bool:
    """True if `value` is a known stale/invalid free-text location."""
    if not value:
        return False
    return value.strip() in OLD_LOCATIONS_TO_PURGE


def get_location_tree() -> List[Dict[str, object]]:
    """Return the LOCATION_GROUPS payload shape used by GET /api/locations."""
    return [
        {
            "key": group["key"],
            "name": group["name"],
            "children": list(group["children"]),  # type: ignore[arg-type]
        }
        for group in LOCATION_GROUPS
    ]
