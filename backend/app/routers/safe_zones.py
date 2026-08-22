from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from database import get_db
from models.safe_zone import SafeZone
from schemas import SafeZoneResponse
from utils.geo import haversine_km

router = APIRouter(prefix="/safe-zones", tags=["safe-zones"])


@router.get("", response_model=list[SafeZoneResponse])
def list_safe_zones(
    response: Response,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
):
    # Shelter locations change rarely; let the browser/CDN reuse the response for a bit.
    response.headers["Cache-Control"] = "public, max-age=300"
    zones = db.query(SafeZone).all()
    results = []
    for z in zones:
        dist = haversine_km(lat, lng, z.lat, z.lng)
        results.append(
            SafeZoneResponse(
                id=z.id,
                name=z.name,
                lat=z.lat,
                lng=z.lng,
                capacity=z.capacity,
                address=z.address,
                distance_km=round(dist, 2),
            )
        )
    results.sort(key=lambda x: x.distance_km or 999)
    return results
