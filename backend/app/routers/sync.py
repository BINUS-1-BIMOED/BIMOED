from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.alert import Alert
from models.safe_zone import SafeZone
from schemas import AlertResponse, SafeZoneResponse, SyncBundleResponse
from services.geospatial import dem_tiles_for_region, nearby_risk_grid
from utils.geo import haversine_km

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/bundle", response_model=SyncBundleResponse)
def sync_bundle(
    region: str = Query("medan"),
    lat: float = Query(3.5952),
    lng: float = Query(98.6722),
    db: Session = Depends(get_db),
):
    zones = db.query(SafeZone).all()
    safe_zones = [
        SafeZoneResponse(
            id=z.id,
            name=z.name,
            lat=z.lat,
            lng=z.lng,
            capacity=z.capacity,
            address=z.address,
            distance_km=round(haversine_km(lat, lng, z.lat, z.lng), 2),
        )
        for z in zones
    ]

    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(20).all()
    recent_alerts = [AlertResponse.model_validate(a) for a in alerts]

    return SyncBundleResponse(
        region=region,
        safe_zones=safe_zones,
        recent_alerts=recent_alerts,
        risk_grid=nearby_risk_grid(lat, lng),
        dem_tiles=dem_tiles_for_region(region),
        last_sync=datetime.now(timezone.utc),
    )
