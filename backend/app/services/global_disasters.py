import asyncio
import time
import logging

import httpx

from services.p2pquake import fetch_japan_earthquakes

logger = logging.getLogger(__name__)

GDACS_EVENT_LIST_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"

# Friendly type names (used in the API's ?type= query) mapped to GDACS's event codes.
EVENT_TYPE_MAP = {
    "flood": "FL",
    "earthquake": "EQ",
    "wildfire": "WF",
    "cyclone": "TC",
    "volcano": "VO",
    "drought": "DR",
}

_CACHE_TTL_SECONDS = 15 * 60
_cache: dict[str, tuple[float, list[dict]]] = {}


def _map_feature(feature: dict) -> dict | None:
    props = feature.get("properties") or {}
    geometry = feature.get("geometry") or {}
    coords = geometry.get("coordinates")
    if not coords or len(coords) < 2:
        return None

    event_code = props.get("eventtype", "")
    type_name = next((name for name, code in EVENT_TYPE_MAP.items() if code == event_code), event_code.lower())
    severity = props.get("severitydata") or {}

    return {
        "id": props.get("eventid"),
        "type": type_name,
        "title": props.get("name") or props.get("htmldescription") or "Disaster event",
        "description": props.get("htmldescription") or props.get("description") or "",
        "country": props.get("country"),
        "alert_level": props.get("alertlevel"),
        "severity_text": severity.get("severitytext"),
        "lat": coords[1],
        "lng": coords[0],
        "from_date": props.get("fromdate"),
        "to_date": props.get("todate"),
        "is_current": props.get("iscurrent") in ("true", True),
        "url": (props.get("url") or {}).get("report"),
    }


async def _fetch_gdacs(event_code: str | None) -> list[dict]:
    """GDACS events, optionally filtered to one event code (e.g. "FL"). Cached
    in-process for a few minutes since this is world data shared by every viewer.
    """
    cache_key = event_code or "all"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(GDACS_EVENT_LIST_URL)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("GDACS unavailable: %s", exc)
        return cached[1] if cached else []

    events: list[dict] = []
    for feature in data.get("features", []):
        mapped = _map_feature(feature)
        if not mapped:
            continue
        if event_code and feature.get("properties", {}).get("eventtype") != event_code:
            continue
        events.append(mapped)

    _cache[cache_key] = (now, events)
    return events


async def fetch_disasters(disaster_type: str | None = None) -> list[dict]:
    """Current global disaster events, optionally filtered by type (one of
    EVENT_TYPE_MAP's keys, e.g. "flood"), or every type when disaster_type is None.

    "earthquake" merges GDACS's global (coarser, delayed) quakes with P2P
    Earthquake Information's much more detailed, real-time Japan-specific feed.
    The unfiltered "all" view includes that same Japan feed on top of GDACS.
    """
    if disaster_type == "earthquake":
        gdacs_eq, jp_eq = await asyncio.gather(
            _fetch_gdacs(EVENT_TYPE_MAP["earthquake"]),
            fetch_japan_earthquakes(),
        )
        return gdacs_eq + jp_eq

    if disaster_type is None:
        gdacs_all, jp_eq = await asyncio.gather(_fetch_gdacs(None), fetch_japan_earthquakes())
        return gdacs_all + jp_eq

    return await _fetch_gdacs(EVENT_TYPE_MAP.get(disaster_type))
