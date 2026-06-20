from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.flood_notification import FloodNotification
from models.alert import Alert
from utils.geo import haversine_km
import logging

logger = logging.getLogger(__name__)


class FloodNotificationService:
    """
    Service for creating and broadcasting flood notifications to users.
    Mimics Google's earthquake/disaster alert system.
    """

    # Notification priority levels
    SEVERITY_LEVELS = {
        "critical": {"priority": 1, "sound": True, "vibration": True},
        "high": {"priority": 2, "sound": True, "vibration": True},
        "moderate": {"priority": 3, "sound": False, "vibration": False},
        "low": {"priority": 4, "sound": False, "vibration": False},
    }

    @staticmethod
    def create_flood_notification(
        db: Session,
        alert_type: str,
        severity: str,
        lat: float,
        lng: float,
        location_name: str,
        title: str,
        description: str,
        source: str,
        radius_km: float = 10,
        expires_in_hours: int = 24,
    ) -> FloodNotification:
        """
        Create a new flood notification alert.
        This triggers broadcasts to users in affected area.
        """
        notification = FloodNotification(
            alert_type=alert_type,
            severity=severity,
            lat=lat,
            lng=lng,
            location_name=location_name,
            radius_km=radius_km,
            title=title,
            description=description,
            source=source,
            expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours),
        )

        db.add(notification)
        db.commit()
        db.refresh(notification)

        logger.info(f"Created flood notification: {notification.id} - {title}")
        return notification

    @staticmethod
    def get_active_notifications(db: Session) -> list[FloodNotification]:
        """Get all currently active flood notifications."""
        return (
            db.query(FloodNotification)
            .filter(
                FloodNotification.expires_at > datetime.utcnow(),
                FloodNotification.is_broadcast == True,
            )
            .order_by(FloodNotification.created_at.desc())
            .all()
        )

    @staticmethod
    def get_notifications_for_location(
        db: Session,
        lat: float,
        lng: float,
        radius_km: float = 15,
    ) -> list[FloodNotification]:
        """
        Get all active notifications affecting a specific location.
        Used to show alerts to users based on their coordinates.
        """
        active = FloodNotificationService.get_active_notifications(db)

        nearby = [
            n
            for n in active
            if haversine_km(lat, lng, n.lat, n.lng) <= (n.radius_km + radius_km)
        ]

        return sorted(
            nearby,
            key=lambda n: (FloodNotificationService.SEVERITY_LEVELS.get(n.severity, {}).get("priority", 5), n.created_at),
            reverse=True,
        )

    @staticmethod
    def broadcast_notification(
        db: Session,
        notification_id: int,
    ) -> dict:
        """
        Broadcast notification to all affected users.
        Returns statistics about broadcast.
        """
        notification = (
            db.query(FloodNotification).filter(FloodNotification.id == notification_id).first()
        )

        if not notification:
            return {"success": False, "error": "Notification not found"}

        if notification.is_broadcast:
            return {"success": False, "error": "Already broadcast"}

        # Mark as broadcast
        notification.is_broadcast = True
        notification.broadcast_at = datetime.utcnow()

        # Simulate broadcast - in production, this would:
        # - Send push notifications via Firebase Cloud Messaging
        # - Send SMS alerts via Twilio
        # - Update real-time WebSocket connections
        # - Send email notifications

        # For now, we create system alerts that can be fetched by clients
        alert = Alert(
            title=notification.title,
            location=notification.location_name,
            lat=notification.lat,
            lng=notification.lng,
            severity=notification.severity,
            source=notification.source,
            description=notification.description,
        )

        db.add(alert)
        db.commit()

        logger.info(f"Broadcast notification {notification_id}: {notification.title}")

        return {
            "success": True,
            "notification_id": notification_id,
            "broadcast_at": notification.broadcast_at.isoformat(),
            "message": "Notification broadcast started",
        }

    @staticmethod
    def format_notification_for_client(notification: FloodNotification) -> dict:
        """
        Format notification for client consumption.
        Similar to Google's earthquake/disaster alert format.
        """
        severity_config = FloodNotificationService.SEVERITY_LEVELS.get(notification.severity, {})

        return {
            "id": notification.id,
            "type": "flood_alert",
            "alert_type": notification.alert_type,
            "severity": notification.severity,
            "severity_rank": severity_config.get("priority", 5),
            "title": notification.title,
            "description": notification.description,
            "location": {
                "name": notification.location_name,
                "lat": notification.lat,
                "lng": notification.lng,
                "radius_km": notification.radius_km,
            },
            "source": notification.source,
            "timestamps": {
                "created": notification.created_at.isoformat(),
                "broadcast": notification.broadcast_at.isoformat() if notification.broadcast_at else None,
                "expires": notification.expires_at.isoformat() if notification.expires_at else None,
            },
            "alert_level": "emergency" if notification.severity == "critical" else "warning",
            "should_vibrate": severity_config.get("vibration", False),
            "should_play_sound": severity_config.get("sound", False),
        }

    @staticmethod
    def cleanup_expired_notifications(db: Session) -> int:
        """Remove expired notifications."""
        expired = (
            db.query(FloodNotification)
            .filter(FloodNotification.expires_at <= datetime.utcnow())
            .delete()
        )
        db.commit()
        return expired


# Severity reference for notification system
SEVERITY_LEVELS = {
    "critical": {"priority": 1, "sound": True, "vibration": True, "color": "#EA4335"},
    "high": {"priority": 2, "sound": True, "vibration": True, "color": "#FBBC04"},
    "moderate": {"priority": 3, "sound": False, "vibration": False, "color": "#F9AB00"},
    "low": {"priority": 4, "sound": False, "vibration": False, "color": "#34A853"},
}
