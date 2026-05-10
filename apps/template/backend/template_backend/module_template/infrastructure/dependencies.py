"""Dependency providers for Template Module routers."""
from fastapi import Depends

from shared_auth import UserIdentity, require_proxy_user

from template_backend.module_template.application.services import (
    TemplateApplicationService,
    create_module_template_service,
)


async def get_module_template_service(
    _user: UserIdentity = Depends(require_proxy_user),
) -> TemplateApplicationService:
    """Return an application service instance."""
    return create_module_template_service()
