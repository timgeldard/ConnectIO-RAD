"""App-side vessel capacity configuration for Runcorn vessel-constrained planning.

Each entry defines the working volume range for a physical vessel.  The planner
tool uses this config to validate whether a vessel can accommodate the quantity
of a released process order.

When an order quantity is unavailable (currently always the case — no confirmed
gold-layer quantity field on released POs), capacity validation degrades gracefully:
the vessel is not excluded from candidates, but an evidence note is added to the
recommendation.

To add a vessel, append a dict with these keys:
  instrument_id   (str, required)  — matches INSTRUMENT_ID in vw_gold_equipment_history
  min_vol         (float, required) — minimum working volume
  max_vol         (float, required) — maximum working volume
  uom             (str, required)  — unit of measure, e.g. "L" or "KG"
  plant_id        (str, optional)  — restrict entry to a specific plant (e.g. "RCN1")
  label           (str, optional)  — human-readable vessel name for display
"""
from typing import Optional


VESSEL_CAPACITY: list[dict] = [
    # Example entry — uncomment and populate with confirmed vessel data:
    # {
    #     "instrument_id": "TK-101",
    #     "min_vol": 500.0,
    #     "max_vol": 2000.0,
    #     "uom": "L",
    #     "plant_id": "RCN1",
    #     "label": "Tank 101",
    # },
]


def get_vessel_capacity(instrument_id: str, plant_id: Optional[str] = None) -> Optional[dict]:
    """Return the capacity config for a vessel, or None if not configured.

    When ``plant_id`` is supplied, only entries that match (or have no plant_id) are
    returned.  If multiple entries match, the most specific one (with a plant_id) wins.
    """
    candidates = [
        c for c in VESSEL_CAPACITY
        if c["instrument_id"] == instrument_id
        and (c.get("plant_id") is None or plant_id is None or c.get("plant_id") == plant_id)
    ]
    if not candidates:
        return None
    # Prefer plant-specific entry over a global one.
    specific = [c for c in candidates if c.get("plant_id") == plant_id]
    return specific[0] if specific else candidates[0]


def check_capacity(instrument_id: str, order_qty: float, plant_id: Optional[str] = None) -> tuple[bool, str]:
    """Check whether a vessel can accommodate ``order_qty``.

    Returns (fits, note) where ``fits`` is True if capacity is satisfied and
    ``note`` is a human-readable explanation for the evidence log.

    Degrades gracefully:
    - Vessel not in config → (True, "no capacity config for <id>")
    - Fits             → (True, "<id> capacity {min}–{max} {uom}, order {qty} {uom}")
    - Doesn't fit      → (False, "<id> excluded — capacity {min}–{max} {uom}, order {qty} {uom}")
    """
    cap = get_vessel_capacity(instrument_id, plant_id)
    if cap is None:
        return True, f"no capacity config for {instrument_id}"
    uom = cap.get("uom", "")
    lo, hi = cap["min_vol"], cap["max_vol"]
    if lo <= order_qty <= hi:
        return True, f"{instrument_id} capacity {lo}–{hi} {uom}, order {order_qty} {uom} fits"
    return False, f"{instrument_id} excluded — capacity {lo}–{hi} {uom}, order qty {order_qty} {uom}"
