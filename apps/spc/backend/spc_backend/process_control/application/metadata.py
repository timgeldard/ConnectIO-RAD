"""Application layer for SPC metadata — authorization and plant-scope coordination."""

from __future__ import annotations

import asyncio
from typing import Optional

from spc_backend.process_control.dal import metadata as _dal
from spc_backend.process_control.dal.authorized_scope import (
    assert_plant_authorized,
    fetch_authorized_plants,
)


async def fetch_plants(token: str, material_id: str) -> list[dict]:
    """Return plants that have SPC data for this material AND are authorized for this user.

    Runs both queries in parallel and returns the intersection so the plant picker
    shows only plants the user can access.
    """
    material_plants, authorized_ids = await asyncio.gather(
        _dal._fetch_material_plants(token, material_id),
        fetch_authorized_plants(token),
    )
    authorized_set = set(authorized_ids)
    return [p for p in material_plants if str(p.get("plant_id", "")) in authorized_set]


async def fetch_characteristics(
    token: str,
    material_id: str,
    plant_id: Optional[str] = None,
) -> tuple[list[dict], list[dict]]:
    """Return quantitative and attribute characteristics, enforcing plant authorization."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_characteristics(token, material_id, plant_id)


async def fetch_attribute_characteristics(
    token: str,
    material_id: str,
    plant_id: Optional[str] = None,
) -> list[dict]:
    """Return attribute characteristics, enforcing plant authorization."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_attribute_characteristics(token, material_id, plant_id)


# No plant_id on these — delegate directly to DAL.
fetch_materials = _dal.fetch_materials
validate_material = _dal.validate_material
