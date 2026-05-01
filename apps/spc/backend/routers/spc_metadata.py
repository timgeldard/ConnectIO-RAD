from typing import Optional

from fastapi import APIRouter, Header, Request

from backend.dal.spc_metadata_dal import (
    fetch_attribute_characteristics,
    fetch_characteristics,
    fetch_materials,
    fetch_plants,
    validate_material,
)
from shared_db.utils import attach_validation_freshness, handle_sql_error
from backend.schemas.spc_schemas import (
    AttributeCharacteristicsRequest,
    CharacteristicsRequest,
    ValidateMaterialRequest,
)
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token
from backend.utils.rate_limit import limiter

router = APIRouter()


@router.get("/plants")
@limiter.limit("120/minute")
async def spc_plants(
    request: Request,
    material_id: str,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    try:
        rows = await fetch_plants(token, material_id)
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"plants": rows},
        token,
        ["spc_plant_material_dim_mv"],
        request_path=request.url.path,
    )


@router.post("/validate-material")
@limiter.limit("120/minute")
async def spc_validate_material(
    request: Request,
    body: ValidateMaterialRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    try:
        row = await validate_material(token, body.material_id)
    except Exception as exc:
        handle_sql_error(exc)

    if not row:
        return await attach_validation_freshness({"valid": False}, token, request.url.path, attach_freshness_func=attach_data_freshness)
    return await attach_validation_freshness(
        {
            "valid": True,
            "material_id": str(row["material_id"]),
            "material_name": str(row["material_name"]),
        },
        token,
        request.url.path,
        attach_freshness_func=attach_data_freshness
    )


@router.get("/ready")
async def ready():
    """Operational readiness probe."""
    try:
        token = resolve_token(None, None)
        await fetch_plants(token, "DUMMY")
        return {"status": "ready"}
    except Exception as exc:
        logger.error("ready_probe.failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "reason": "sql_warehouse_unreachable",
                "message": "An internal error occurred while reaching the SQL warehouse.",
                "error": str(exc),
            },
        )


@router.get("/materials")
@limiter.limit("120/minute")
async def spc_materials(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    try:
        rows = await fetch_materials(token)
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"materials": rows},
        token,
        ["spc_material_dim_mv"],
        request_path=request.url.path,
    )


@router.post("/characteristics")
@limiter.limit("60/minute")
async def spc_characteristics(
    request: Request,
    body: CharacteristicsRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    try:
        characteristics, attr_characteristics = await fetch_characteristics(token, body.material_id, body.plant_id)
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"characteristics": characteristics, "attr_characteristics": attr_characteristics},
        token,
        ["spc_characteristic_dim_mv", "spc_attribute_quality_metrics", "spc_quality_metric_subgroup_v"],
        request_path=request.url.path,
    )


@router.post("/attribute-characteristics")
@limiter.limit("60/minute")
async def spc_attribute_characteristics(
    request: Request,
    body: AttributeCharacteristicsRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    try:
        rows = await fetch_attribute_characteristics(token, body.material_id, body.plant_id)
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"characteristics": rows},
        token,
        ["spc_attribute_quality_metrics"],
        request_path=request.url.path,
    )
