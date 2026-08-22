import math


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bounding_box(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """Conservative lat/lng box that fully contains the radius_km circle around (lat, lng).

    Meant as a cheap, index-friendly pre-filter before the exact haversine_km
    check — never excludes a point that the circle would include.
    """
    dlat = radius_km / 111.0
    dlng = radius_km / (111.0 * max(0.2, abs(math.cos(math.radians(lat)))))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def risk_label(score: float) -> str:
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Moderate"
    return "Low"
