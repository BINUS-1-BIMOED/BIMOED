import time
import logging

import httpx

logger = logging.getLogger(__name__)

# P2P Earthquake Information (Japan) — https://www.p2pquake.net/develop/json_api_v2/
P2PQUAKE_HISTORY_URL = "https://api.p2pquake.net/v2/history"
EARTHQUAKE_CODE = 551

# JMA seismic intensity (shindo) scale — maxScale in the API is this value * 10.
SCALE_LABELS = {
    10: "1",
    20: "2",
    30: "3",
    40: "4",
    45: "5弱",
    50: "5強",
    55: "6弱",
    60: "6強",
    70: "7",
}

_CACHE_TTL_SECONDS = 5 * 60  # earthquakes are frequent — refresh more often than GDACS
_cache: tuple[float, list[dict]] | None = None


def _map_earthquake(item: dict) -> dict | None:
    eq = item.get("earthquake")
    if not eq:
        return None
    hypocenter = eq.get("hypocenter") or {}
    lat = hypocenter.get("latitude")
    lng = hypocenter.get("longitude")
    if lat is None or lng is None:
        return None

    max_scale = eq.get("maxScale")
    scale_label = SCALE_LABELS.get(max_scale, str(max_scale) if max_scale is not None else "?")
    magnitude = hypocenter.get("magnitude")
    name = hypocenter.get("name") or "Jepang"

    alert_level = "Red" if (max_scale or 0) >= 50 else ("Orange" if (max_scale or 0) >= 30 else "Green")

    return {
        "id": item.get("id"),
        "type": "earthquake",
        "title": f"Gempa {name} (M{magnitude if magnitude is not None else '?'})",
        "description": f"Intensitas maksimum: Shindo {scale_label}",
        "country": "Japan",
        "alert_level": alert_level,
        "severity_text": f"Magnitude {magnitude}" if magnitude is not None else None,
        "lat": lat,
        "lng": lng,
        "from_date": eq.get("time"),
        "to_date": None,
        "is_current": True,
        "url": "https://www.p2pquake.net/",
    }


async def fetch_japan_earthquakes(limit: int = 30) -> list[dict]:
    """Recent earthquakes detected in/around Japan, from the P2P Earthquake
    Information API. Cached in-process briefly since this is shared world data.
    """
    global _cache
    now = time.time()
    if _cache and now - _cache[0] < _CACHE_TTL_SECONDS:
        return _cache[1]

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(P2PQUAKE_HISTORY_URL, params={"codes": EARTHQUAKE_CODE, "limit": limit})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("P2PQuake unavailable: %s", exc)
        return _cache[1] if _cache else []

    events = [mapped for item in data if (mapped := _map_earthquake(item))]
    _cache = (now, events)
    return events
