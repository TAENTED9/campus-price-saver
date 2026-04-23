"""
Migration script: fix_photos_data.py
------------------------------------
Normalises the `photos` column in the `prices` table.

The column stores a JSON-encoded list of URL strings.  Over time, three types
of corrupt values can accumulate:

  1. Bare string  (e.g. "https://…")     → wrap in a list and re-encode
  2. Malformed JSON (not parseable)       → reset to "[]"
  3. NULL / empty string                  → reset to "[]"
  4. Already a valid JSON *list*          → leave unchanged
  5. JSON-encoded non-list (e.g. a dict) → reset to "[]"

Run from the project root:
    python fix_photos_data.py

Safe to run multiple times (idempotent).
"""

import json
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")


def normalise(raw) -> str:
    """Return a JSON string that is always a list of strings."""
    if not raw:
        return "[]"
    if isinstance(raw, list):
        return json.dumps([str(u) for u in raw])
    if not isinstance(raw, str):
        return "[]"

    stripped = raw.strip()
    if not stripped:
        return "[]"

    # Try to parse existing JSON
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        # Not JSON at all — treat as a bare URL
        return json.dumps([stripped])

    if isinstance(parsed, list):
        # Already a list — normalise each element to string
        return json.dumps([str(u) for u in parsed])

    if isinstance(parsed, str):
        # json.loads turned it into a plain string (double-encoded) → wrap it
        return json.dumps([parsed])

    # Anything else (dict, int…) → reset
    return "[]"


def main():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT id, photos FROM prices")
    rows = cur.fetchall()

    fixed = 0
    for row in rows:
        original = row["photos"]
        corrected = normalise(original)
        if original != corrected:
            cur.execute("UPDATE prices SET photos = ? WHERE id = ?", (corrected, row["id"]))
            print(f"  [FIX] id={row['id']}: {repr(original)} → {repr(corrected)}")
            fixed += 1

    conn.commit()
    conn.close()
    print(f"\nDone. {fixed} row(s) updated out of {len(rows)} total.")


if __name__ == "__main__":
    main()
