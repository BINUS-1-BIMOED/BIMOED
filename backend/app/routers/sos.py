import asyncio
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.alert import Alert
from models.sos import SOS
from schemas import SOSCreate, SOSResponse
from services.weather import WeatherService
from utils.geo import bounding_box, haversine_km

router = APIRouter(prefix="/sos", tags=["sos"])
weather_service = WeatherService()
logger = logging.getLogger(__name__)

# Hard cap on how long the risk-gate check may take. Weather/elevation
# providers are external and occasionally slow; an emergency SOS submission
# must never be stuck waiting on them.
RISK_CHECK_TIMEOUT_S = 5.0

COOLDOWN_MINUTES = 5


@router.get("", response_model=list[SOSResponse])
def list_sos_alerts(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get active SOS alerts near location."""
    lat_min, lat_max, lng_min, lng_max = bounding_box(lat, lng, radius_km)
    sos_alerts = (
        db.query(SOS)
        .filter(
            SOS.status == "active",
            SOS.lat.between(lat_min, lat_max),
            SOS.lng.between(lng_min, lng_max),
        )
        .order_by(SOS.created_at.desc())
        .all()
    )
    nearby = [s for s in sos_alerts if haversine_km(lat, lng, s.lat, s.lng) <= radius_km]
    return nearby


@router.post("", response_model=SOSResponse, status_code=201)
async def create_sos(payload: SOSCreate, db: Session = Depends(get_db)):
    """Submit SOS alert with validation and cooldown check."""
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

    # SOS must never be refused: a person submitting one is, by definition, asking
    # for help, regardless of what an automated flood-risk model thinks of their
    # location — the model can be wrong, and the emergency may not even be flood-
    # related. The risk check below is triage context for responders only, attached
    # to the alert description, and is never allowed to block the submission. It's
    # also time-boxed, since weather/elevation providers are external and slow or
    # down should never stall someone in danger waiting on a risk score.
    risk_note = ""
    try:
        risk_points = await asyncio.wait_for(
            weather_service.build_risk_grid(db, payload.lat, payload.lng, count=8, hour_offsets=(0,)),
            timeout=RISK_CHECK_TIMEOUT_S,
        )
        max_risk = max((p["score"] for p in risk_points), default=0)
        max_rain = max((p.get("rainfall_mm", 0) for p in risk_points), default=0)
        risk_note = f" [Flood risk at location: {max_risk:.0f}/100, rainfall {max_rain:.1f}mm]"
    except asyncio.TimeoutError:
        logger.warning("SOS risk check timed out at (%s, %s) — proceeding without a risk note", payload.lat, payload.lng)

    sos = SOS(**payload.model_dump())
    db.add(sos)

    severity = "critical" if payload.urgency == "critical" else "high" if payload.urgency == "medium" else "moderate"
    alert = Alert(
        title=f"SOS Emergency ({payload.urgency})",
        location=f"Near {payload.lat:.4f}, {payload.lng:.4f}",
        lat=payload.lat,
        lng=payload.lng,
        severity=severity,
        source="sos",
        description=(
            f"Age: {payload.age}. "
            f"{'Person with disability. ' if payload.is_disabled else ''}"
            f"{payload.description or 'Immediate assistance required.'}"
            f"{risk_note}"
        ),
    )
    db.add(alert)
    db.commit()
    db.refresh(sos)
    return sos


@router.patch("/{sos_id}/resolve", response_model=SOSResponse)
def resolve_sos(sos_id: int, db: Session = Depends(get_db)):
    """Mark SOS alert as resolved."""
    sos = db.query(SOS).filter(SOS.id == sos_id).first()
    if not sos:
        raise HTTPException(status_code=404, detail="SOS alert not found")

    sos.status = "resolved"
    sos.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(sos)
    return sos
