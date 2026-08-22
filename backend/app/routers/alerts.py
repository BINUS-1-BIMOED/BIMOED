from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.alert import Alert
from schemas import AlertCreate, AlertResponse
from utils.geo import bounding_box, haversine_km

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    lat_min, lat_max, lng_min, lng_max = bounding_box(lat, lng, radius_km)
    alerts = (
        db.query(Alert)
        .filter(Alert.lat.between(lat_min, lat_max), Alert.lng.between(lng_min, lng_max))
        .order_by(Alert.created_at.desc())
        .all()
    )
    nearby = [a for a in alerts if haversine_km(lat, lng, a.lat, a.lng) <= radius_km]
    return nearby


@router.post("", response_model=AlertResponse, status_code=201)
def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
