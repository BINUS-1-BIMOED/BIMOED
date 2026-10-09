from fastapi import APIRouter, Query

from services.global_disasters import fetch_disasters

router = APIRouter(prefix="/disasters", tags=["disasters"])


@router.get("")
async def list_disasters(
    type: str | None = Query(
        None, description="all (default), flood, earthquake, wildfire, cyclone, volcano, drought"
    ),
):
    """Current natural disaster events worldwide, for the globe's world view.

    Sourced from GDACS, except "earthquake" which also pulls in P2P Earthquake
    Information (Japan-focused, real-time) — see services/global_disasters.py.
    """
    events = await fetch_disasters(None if type in (None, "all") else type)
    return {"events": events}
