"""Router — GET /api/plants for the analytics filter bar."""

from fastapi import APIRouter, Depends

from shared_auth import UserIdentity, require_proxy_user

from processorderhistory_backend.dal.plants_dal import fetch_plants
from processorderhistory_backend.db import check_warehouse_config
from processorderhistory_backend.utils.rate_limit import limiter

router = APIRouter()


@router.get("/plants")
@limiter.limit("30/minute")
async def list_plants(
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return plants visible in POH data with human-readable names."""
    check_warehouse_config()
    plants = await fetch_plants(user.raw_token)
    return {"plants": plants}
