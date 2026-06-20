from datetime import datetime
from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class FloodNotification(Base):
    __tablename__ = "escood_flood_notifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    alert_type: Mapped[str] = mapped_column(String(32), nullable=False)  # "flood", "warning", "watch", "advisory"
    severity: Mapped[str] = mapped_column(String(16), nullable=False)  # critical, high, moderate, low
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    radius_km: Mapped[float] = mapped_column(Float, default=10)  # Alert radius
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)  # "government", "community", "system", "sensor"
    
    # Notification tracking
    is_broadcast: Mapped[bool] = mapped_column(default=False)
    broadcast_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    users_notified: Mapped[int] = mapped_column(default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
