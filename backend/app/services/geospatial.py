import math
import requests


def estimate_elevation(lat: float, lng: float) -> float:
    """Try to fetch real elevation from Open-Meteo API, fall back to heuristic on failure."""
    try:
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lng}"
        resp = requests.get(url, timeout=3.0)
        if resp.status_code == 200:
            data = resp.json()
            elevations = data.get("elevation")
            if elevations and isinstance(elevations, list) and len(elevations) > 0:
                val = elevations[0]
                if val is not None:
                    return round(float(val), 1)
    except Exception:
        pass

    # SRTM-inspired heuristic for Medan basin when DEM tiles/API are unavailable
    center_lat, center_lng = 3.5952, 98.6722
    dist = math.sqrt((lat - center_lat) ** 2 + (lng - center_lng) ** 2)
    base = 8.0 + (dist * 120)
    return round(min(max(base, 3.0), 45.0), 1)


def nearby_risk_grid(lat: float, lng: float, radius_km: float = 5.0, step: float = 0.02) -> list[dict]:
    points = []
    lat_min, lat_max = lat - 0.05, lat + 0.05
    lng_min, lng_max = lng - 0.05, lng + 0.05
    idx = 0
    y = lat_min
    while y <= lat_max:
        x = lng_min
        while x <= lng_max:
            dist = math.sqrt((y - lat) ** 2 + (x - lng) ** 2) * 111
            if dist <= radius_km:
                elev = estimate_elevation(y, x)
                score = min(95, max(10, 70 - elev + dist * 4 + (idx % 5) * 3))
                points.append({"lat": round(y, 4), "lng": round(x, 4), "score": round(score, 1), "elevation_m": elev})
                idx += 1
            x += step
        y += step
    return points


def dem_tiles_for_region(region: str = "medan") -> list[dict]:
    return [
        {"id": f"{region}-tile-1", "bounds": [3.55, 98.62, 3.64, 98.70], "resolution_m": 30},
        {"id": f"{region}-tile-2", "bounds": [3.64, 98.62, 3.73, 98.70], "resolution_m": 30},
    ]
