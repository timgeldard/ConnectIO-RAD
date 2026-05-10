"""Application services for Process Order History plant discovery."""

from processorderhistory_backend.dal.plants_dal import fetch_plants as fetch_plant_rows


async def list_visible_plants(token: str) -> dict:
    """Return plants visible in POH data for the filter bar.

    Args:
        token: Databricks access token forwarded from the Databricks proxy.

    Returns:
        Dictionary containing the ordered list of plant objects expected by the
        router contract.
    """
    return {"plants": await fetch_plant_rows(token)}
