"""FastAPI router for Template Module."""
from fastapi import APIRouter, Depends, HTTPException, status

from shared_auth import UserIdentity, require_proxy_user
from template_backend.module_template.application.services import TemplateApplicationService
from template_backend.module_template.infrastructure.dependencies import get_module_template_service
from template_backend.module_template.schemas import (
    TemplateCreateRequest,
    TemplateOverview,
    TemplateSignalDTO,
    TemplateStatusUpdateRequest,
)

router = APIRouter()


@router.get("/overview", response_model=TemplateOverview)
async def overview(
    plant_id: str | None = None,
    user: UserIdentity = Depends(require_proxy_user),
    service: TemplateApplicationService = Depends(get_module_template_service),
) -> TemplateOverview:
    """Return the Template Module overview read model."""
    snapshot = await service.get_overview(user.raw_token, plant_id=plant_id)
    return TemplateOverview.from_snapshot(snapshot)


@router.get("/signals", response_model=list[TemplateSignalDTO])
async def list_signals(
    plant_id: str | None = None,
    user: UserIdentity = Depends(require_proxy_user),
    service: TemplateApplicationService = Depends(get_module_template_service),
) -> list[TemplateSignalDTO]:
    """Return actionable Template Module signals."""
    signals = await service.signals(user.raw_token, plant_id=plant_id)
    return [TemplateSignalDTO.from_entity(s) for s in signals]


@router.get("/signals/{signal_id}", response_model=TemplateSignalDTO)
async def get_signal(
    signal_id: str,
    user: UserIdentity = Depends(require_proxy_user),
    service: TemplateApplicationService = Depends(get_module_template_service),
) -> TemplateSignalDTO:
    """Return one actionable signal."""
    signal = await service.signal(user.raw_token, signal_id)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return TemplateSignalDTO.from_entity(signal)


@router.post("/signals", response_model=TemplateSignalDTO, status_code=status.HTTP_201_CREATED)
async def create_signal(
    body: TemplateCreateRequest,
    user: UserIdentity = Depends(require_proxy_user),
    service: TemplateApplicationService = Depends(get_module_template_service),
) -> TemplateSignalDTO:
    """Create a demo signal.

    TODO: replace this command with the production workflow boundary once the
    bounded context owns write-enabled domain behavior.
    """
    signal = await service.create(
        user.raw_token,
        plant_id=body.plant_id,
        title=body.title,
        status=body.status,
    )
    return TemplateSignalDTO.from_entity(signal)


@router.patch("/signals/{signal_id}/status", response_model=TemplateSignalDTO)
async def update_signal_status(
    signal_id: str,
    body: TemplateStatusUpdateRequest,
    user: UserIdentity = Depends(require_proxy_user),
    service: TemplateApplicationService = Depends(get_module_template_service),
) -> TemplateSignalDTO:
    """Update one signal workflow status."""
    signal = await service.set_status(user.raw_token, signal_id, body.status)
    if signal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return TemplateSignalDTO.from_entity(signal)
