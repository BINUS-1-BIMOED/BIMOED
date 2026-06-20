from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models.flood_notification import FloodNotification
from schemas import FloodNotificationCreate, FloodNotificationResponse
from services.notification import FloodNotificationService
from services.flood_api import FloodAPIService

router = APIRouter(prefix="/flood-alerts", tags=["flood-alerts"])


@router.post("/notifications", response_model=FloodNotificationResponse, status_code=201)
def create_flood_notification(
    payload: FloodNotificationCreate,
    db: Session = Depends(get_db),
):
    """Create a new flood notification alert"""
    notification = FloodNotificationService.create_flood_notification(
        db=db,
        alert_type=payload.alert_type,
        severity=payload.severity,
        lat=payload.lat,
        lng=payload.lng,
        location_name=payload.location_name,
        title=payload.title,
        description=payload.description,
        source=payload.source,
        radius_km=payload.radius_km,
    )
    return notification


@router.get("/notifications/active", response_model=list[FloodNotificationResponse])
def get_active_notifications(db: Session = Depends(get_db)):
    """Get all currently active flood notifications"""
    notifications = FloodNotificationService.get_active_notifications(db)
    return notifications


@router.get("/notifications/nearby", response_model=list[dict])
def get_nearby_notifications(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(15, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get flood notifications affecting user's location"""
    notifications = FloodNotificationService.get_notifications_for_location(
        db=db,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
    )

    return [
        FloodNotificationService.format_notification_for_client(n)
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/broadcast", response_model=dict)
def broadcast_notification(
    notification_id: int,
    db: Session = Depends(get_db),
):
    """Broadcast a flood notification to all affected users"""
    result = FloodNotificationService.broadcast_notification(db=db, notification_id=notification_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Broadcast failed"))
    return result


@router.get("/external/singapore", response_model=dict)
async def fetch_singapore_flood_alerts():
    """Fetch real-time flood alerts from Singapore government API"""
    return await FloodAPIService.get_singapore_flood_alerts()


@router.get("/external/bmkg", response_model=dict)
async def fetch_bmkg_weather_alerts():
    """Fetch weather alerts from Indonesian weather agency (BMKG)"""
    return await FloodAPIService.get_bmkg_weather_alerts()


@router.get("/forecast", response_model=dict)
async def get_rainfall_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    hours: int = Query(24, ge=1, le=168),
):
    """Get rainfall forecast for a specific location"""
    return await FloodAPIService.get_rainfall_forecast((lat, lng), hours)


@router.delete("/notifications/{notification_id}/cleanup")
def cleanup_notifications(db: Session = Depends(get_db)):
    """Remove expired notifications"""
    count = FloodNotificationService.cleanup_expired_notifications(db)
    return {"cleaned_count": count, "message": f"Removed {count} expired notifications"}
