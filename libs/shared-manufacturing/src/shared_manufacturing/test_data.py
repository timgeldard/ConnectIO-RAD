"""
Shared utilities for generating realistic SAP supply chain test data.
Follows standard SAP naming conventions (e.g. 10-digit batches, 12-digit orders).
"""
import random
import string
from datetime import datetime, timedelta


# Realistic Plant IDs from Kerry portfolio
PLANTS = ["C351", "IE01", "DE01", "US10", "UK20", "BR30"]

# Realistic UOMs
UOMS = ["KG", "L", "G", "PAL", "EA", "PC", "TO"]

# Realistic Material Categories
CATEGORIES = ["Dairy", "Taste", "Pharma", "Nutrition", "Raw Material", "Packaging"]


def random_sap_id(length: int) -> str:
    """Generate a numeric string of fixed length, potentially with leading zeros."""
    return "".join(random.choices(string.digits, k=length))


def material_id() -> str:
    """8-digit SAP material number (standard)."""
    return random_sap_id(8)


def batch_id() -> str:
    """10-digit SAP batch number."""
    return random_sap_id(10)


def process_order() -> str:
    """12-digit SAP process order number."""
    return random_sap_id(12)


def inspection_lot() -> str:
    """12-digit SAP inspection lot number."""
    return f"01{random_sap_id(10)}"


def sap_date(days_ago: int = 0) -> str:
    """ISO format date (YYYY-MM-DD) common in Gold layer views."""
    dt = datetime.now() - timedelta(days=days_ago)
    return dt.strftime("%Y-%m-%d")


def mic_id() -> str:
    """Realistic Master Inspection Characteristic ID."""
    prefixes = ["VISC", "PH", "MOIST", "TEMP", "WEIGHT", "COLOR"]
    return f"{random.choice(prefixes)}_{random.randint(1, 999):03d}"


def sample_material_name() -> str:
    """Realistic Kerry-like material description."""
    adjectives = ["PRE-COOK", "ULTRA", "PURE", "CONCENTRATE", "DRY", "LIQUID"]
    nouns = ["NUGGET", "WHEY", "SYRUP", "POWDER", "EXTRACT", "FLAVOUR"]
    size = f"{random.randint(1, 50)}KG"
    return f"PRT{random.randint(1000, 9999)} {random.choice(adjectives)} {random.choice(nouns)} {size}"


def generate_batch_row(overrides: dict | None = None) -> dict:
    """Generate a realistic gold_stock / silver_stock row."""
    mat_id = material_id()
    plant = random.choice(PLANTS)
    row = {
        "material_id": mat_id,
        "batch_id": batch_id(),
        "plant_id": plant,
        "storage_id": f"S{random.randint(10, 99):02d}",
        "material_name": sample_material_name(),
        "unrestricted": str(float(random.randint(100, 5000))),
        "qi": "0.000",
        "blocked": "0.000",
        "total_stock": str(float(random.randint(100, 5000))),
        "uom": random.choice(UOMS),
        "manufacture_date": sap_date(random.randint(1, 30)),
    }
    if overrides:
        row.update(overrides)
    return row


def generate_order_row(overrides: dict | None = None) -> dict:
    """Generate a realistic vw_gold_process_order row."""
    row = {
        "process_order_id": process_order(),
        "inspection_lot_id": inspection_lot(),
        "material_id": material_id(),
        "material_name": sample_material_name(),
        "material_category": random.choice(CATEGORIES),
        "plant_id": random.choice(PLANTS),
        "status": random.choice(["running", "completed", "released", "created"]),
        "start_ms": int(datetime.now().timestamp() * 1000),
        "end_ms": int((datetime.now() + timedelta(hours=4)).timestamp() * 1000),
        "actual_qty": str(float(random.randint(500, 20000))),
        "qty_uom": random.choice(UOMS),
    }
    if overrides:
        row.update(overrides)
    return row
