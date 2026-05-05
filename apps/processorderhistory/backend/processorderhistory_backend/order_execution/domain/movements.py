"""Domain rules for process-order goods movements."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared_domain import ValueObject


@dataclass(frozen=True)
class MovementQuantity(ValueObject):
    """Quantity value object with manufacturing UOM normalization rules."""

    amount: float
    uom: Optional[str] = None

    @property
    def normalized_uom(self) -> str:
        return (self.uom or "").strip().upper()

    def to_kg(self) -> float:
        if self.normalized_uom == "EA":
            return 0.0
        if self.normalized_uom == "G":
            return self.amount / 1000.0
        return self.amount

    @property
    def material_summary_uom(self) -> Optional[str]:
        if self.normalized_uom in {"G", "KG"}:
            return "KG"
        return self.uom


@dataclass(frozen=True)
class GoodsMovement(ValueObject):
    """Goods movement value object for process-order material movements."""

    movement_type: str
    material_id: str
    material_name: Optional[str]
    batch_id: Optional[str]
    quantity: MovementQuantity

    @classmethod
    def from_row(cls, row: dict) -> "GoodsMovement":
        return cls(
            movement_type=str(row.get("movement_type", "")),
            material_id=str(row.get("material_id", "")),
            material_name=row.get("material_name"),
            batch_id=row.get("batch_id"),
            quantity=MovementQuantity(float(row.get("quantity") or 0), row.get("uom")),
        )

    @property
    def quantity_kg(self) -> float:
        return self.quantity.to_kg()

    @property
    def is_packaging_each(self) -> bool:
        return self.quantity.normalized_uom == "EA"


@dataclass(frozen=True)
class MovementSummary(ValueObject):
    """Net issued and received quantities for a process order."""

    qty_issued_kg: Optional[float]
    qty_received_kg: Optional[float]

    def to_dict(self) -> dict:
        return {
            "qty_issued_kg": self.qty_issued_kg,
            "qty_received_kg": self.qty_received_kg,
        }


def _positive_or_none(value: float) -> Optional[float]:
    rounded = round(value, 6)
    return rounded if rounded > 0 else None


def movement_summary(rows: list[dict]) -> MovementSummary:
    """Calculate net 261/262 issued and 101/102 received quantities."""

    movements = [GoodsMovement.from_row(row) for row in rows]
    issued = sum(m.quantity_kg for m in movements if m.movement_type == "261")
    issued -= sum(m.quantity_kg for m in movements if m.movement_type == "262")
    received = sum(m.quantity_kg for m in movements if m.movement_type == "101")
    received -= sum(m.quantity_kg for m in movements if m.movement_type == "102")
    return MovementSummary(qty_issued_kg=_positive_or_none(issued), qty_received_kg=_positive_or_none(received))


def derive_materials(rows: list[dict]) -> list[dict]:
    """Aggregate net component materials from 261/262 goods movements."""

    seen: dict[str, dict] = {}
    for movement in (GoodsMovement.from_row(row) for row in rows):
        if movement.movement_type not in {"261", "262"} or movement.is_packaging_each:
            continue

        sign = -1.0 if movement.movement_type == "262" else 1.0
        if movement.material_id not in seen:
            seen[movement.material_id] = {
                "material_id": movement.material_id,
                "material_name": movement.material_name,
                "batch_id": movement.batch_id if movement.movement_type == "261" else None,
                "total_qty": 0.0,
                "uom": movement.quantity.material_summary_uom,
            }
        elif movement.movement_type == "261" and seen[movement.material_id]["batch_id"] is None:
            seen[movement.material_id]["batch_id"] = movement.batch_id

        seen[movement.material_id]["total_qty"] += sign * movement.quantity_kg

    result = []
    for item in seen.values():
        item["total_qty"] = round(item["total_qty"], 6)
        if item["total_qty"] > 0:
            result.append(item)
    return result
