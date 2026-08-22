from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SOS(Base):
    __tablename__ = "escood_sos"
    __table_args__ = (
        Index("ix_escood_sos_lat_lng", "lat", "lng"),
        Index("ix_escood_sos_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    is_disabled: Mapped[bool] = mapped_column(default=False)
    urgency: Mapped[str] = mapped_column(String(16), nullable=False)  # low, medium, critical
    status: Mapped[str] = mapped_column(String(16), default="active")  # active, resolved, cancelled
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
