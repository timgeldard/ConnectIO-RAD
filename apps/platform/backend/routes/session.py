from fastapi import APIRouter, Depends

from shared_auth.identity import UserIdentity, require_proxy_user

router = APIRouter()


@router.get("/api/platform/me", tags=["Platform"])
async def get_platform_session(
    user: UserIdentity = Depends(require_proxy_user),
) -> dict[str, str | list[str] | None]:
    """Return the authenticated shell user for Platform-owned UI context.

    Args:
        user: The authenticated user's identity, injected as a dependency.

    Returns:
        A dictionary containing the user's session information.
    """
    display_name = user.display_name or user.email or user.user_id
    return {
        "userId": user.user_id,
        "email": user.email,
        "name": display_name,
        "groups": user.groups,
    }
