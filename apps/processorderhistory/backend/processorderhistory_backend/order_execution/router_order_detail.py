from fastapi import APIRouter, Depends, HTTPException

from processorderhistory_backend.order_execution.application import queries as order_queries
from processorderhistory_backend.db import check_warehouse_config
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


@router.get("/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Return comprehensive execution and quality details for a process order.

    Aggregates data from confirmation records, goods movements (MT 101/261),
    operator notes, downtime events, equipment logs, and QA inspection lots.

    Args:
        order_id: The unique SAP process order identifier.
        user: Authenticated user identity from the shared auth dependency.

    Returns:
        A deeply nested JSON object containing:
        - order: Core header metadata (status, material, batch).
        - time_summary: Total setup, machine, and labor timings.
        - movement_summary: Aggregated issued vs received quantities.
        - phases: Detailed process phase timings and quantities.
        - materials: List of BOM components consumed (MT 261).
        - movements: Individual transaction log for all goods movements.
        - comments: Operator-entered notes and feedback.
        - downtime: List of unplanned downtime events.
        - equipment: Instrument and vessel state change log.
        - inspections: Characteristic-level quality results.
        - usage_decision: Final QA valuation and quality score.

    Raises:
        HTTPException: 401 if unauthorized, 404 if the order is not found,
                       or 503/500 for database and internal errors.
    """
    token = user.raw_token
    check_warehouse_config()
    detail = await order_queries.get_order_detail(token, order_id=order_id)
    if not detail:
        raise HTTPException(
            status_code=404, detail=f"Process order '{order_id}' not found."
        )
    return detail
