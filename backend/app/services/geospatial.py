import math
import httpx

# Simple in-memory elevation cache to avoid repeated API calls
_elevation_cache: dict[str, float] = {}


def estimate_elevation(lat: float, lng: float) -> float:
    """Try to fetch real elevation from Open-Meteo API, fall back to heuristic on failure."""
    key = f"{lat:.4f}:{lng:.4f}"
    cached = _elevation_cache.get(key)
    if cached is not None:
        return cached

    try:
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lng}"
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                elevations = data.get("elevation")
                if elevations and isinstance(elevations, list) and len(elevations) > 0:
                    val = elevations[0]
                    if val is not None:
                        result = round(float(val), 1)
                        _elevation_cache[key] = result
                        return result
    except Exception:
        pass

    # SRTM-inspired heuristic for Medan basin when DEM tiles/API are unavailable
    center_lat, center_lng = 3.5952, 98.6722
    dist = math.sqrt((lat - center_lat) ** 2 + (lng - center_lng) ** 2)
    base = 8.0 + (dist * 120)
    result = round(min(max(base, 3.0), 45.0), 1)
    _elevation_cache[key] = result
    return result


def dem_tiles_for_region(region: str = "medan") -> list[dict]:
    return [
        {"id": f"{region}-tile-1", "bounds": [3.55, 98.62, 3.64, 98.70], "resolution_m": 30},
        {"id": f"{region}-tile-2", "bounds": [3.64, 98.62, 3.73, 98.70], "resolution_m": 30},
    ]
