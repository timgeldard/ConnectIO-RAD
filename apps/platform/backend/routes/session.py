from fastapi import APIRouter, Depends

from shared_auth.identity import UserIdentity, require_proxy_user

router = APIRouter()


def _first_name(display_name: str | None, email: str | None) -> str:
    """Derive a friendly first-name from available identity fields.

    Prefers the JWT ``name`` claim (e.g. "Tim Geldard" → "Tim").
    Falls back to the email local part when no display name is available
    (e.g. "tim.geldard@kerry.com" → "Tim").

    Args:
        display_name: Full display name from the JWT ``name`` claim, or
            ``None`` if the claim was absent.
        email: The user's email address, used as a fallback source.

    Returns:
        A capitalised first name string, never empty.
    """
    if display_name and "@" not in display_name:
        return display_name.split()[0]
    # display_name is an email, or absent — extract from whichever is available
    email_src = email or display_name or ""
    local = email_src.split("@")[0]
    if local:
        return local.split(".")[0].capitalize()
    return "there"


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
    return {
        "userId": user.user_id,
        "email": user.email,
        "name": _first_name(user.display_name, user.email),
        "groups": user.groups,
    }
