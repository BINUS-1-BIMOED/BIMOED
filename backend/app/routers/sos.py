from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.sos import SOS
from schemas import SOSCreate, SOSResponse
from services.geospatial import nearby_risk_grid
from utils.geo import haversine_km

router = APIRouter(prefix="/sos", tags=["sos"])

# Cooldown duration in minutes
COOLDOWN_MINUTES = 5


@router.get("", response_model=list[SOSResponse])
def list_sos_alerts(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get active SOS alerts near location"""
    sos_alerts = (
        db.query(SOS)
        .filter(SOS.status == "active")
        .order_by(SOS.created_at.desc())
        .all()
    )
    nearby = [s for s in sos_alerts if haversine_km(lat, lng, s.lat, s.lng) <= radius_km]
    return nearby


@router.post("", response_model=SOSResponse, status_code=201)
def create_sos(payload: SOSCreate, db: Session = Depends(get_db)):
    """Submit SOS alert with validation and cooldown check"""
    # Cooldown check - prevent spam from same location/user
    if payload.user_id:
        recent = (
            db.query(SOS)
            .filter(
                SOS.user_id == payload.user_id,
                SOS.created_at >= datetime.utcnow() - timedelta(minutes=COOLDOWN_MINUTES),
                SOS.status == "active",
            )
            .first()
        )
        if recent:
            raise HTTPException(
                status_code=429,
                detail=f"SOS cooldown active. Please wait {COOLDOWN_MINUTES} minutes before submitting another alert.",
            )

    # Location validation - check if location is near high-risk area
    risk_points = nearby_risk_grid(payload.lat, payload.lng)
    max_risk = max((p.score for p in risk_points), default=0)

    # Only allow SOS in moderate to critical risk areas
    if max_risk < 40:
        raise HTTPException(
            status_code=400,
            detail="SOS can only be submitted in flood-risk areas (risk score >= 40)",
        )

    sos = SOS(**payload.model_dump())
    db.add(sos)
    db.commit()
    db.refresh(sos)
    return sos


@router.patch("/{sos_id}/resolve", response_model=SOSResponse)
def resolve_sos(sos_id: int, db: Session = Depends(get_db)):
    """Mark SOS alert as resolved"""
    sos = db.query(SOS).filter(SOS.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS alert not found")

    sos.status = "resolved"
    sos.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(sos)
    return sos
