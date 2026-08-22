from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Report(Base):
    __tablename__ = "escood_reports"
    __table_args__ = (
        Index("ix_escood_reports_lat_lng", "lat", "lng"),
        Index("ix_escood_reports_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    validation_status: Mapped[str] = mapped_column(String(16), default="pending")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Trust score system
    trust_score: Mapped[float] = mapped_column(Float, default=0.5)  # 0-1 scale
    user_history_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)  # Historical accuracy of this user
    geographical_consistency: Mapped[float | None] = mapped_column(Float, nullable=True)  # Is location reasonable?
    temporal_consistency: Mapped[float | None] = mapped_column(Float, nullable=True)  # Does timing match weather?
    
    # Community validation
    validation_votes: Mapped[int] = mapped_column(Integer, default=0)  # Number of validations
    validation_score: Mapped[float] = mapped_column(Float, default=0.5)  # Community consensus score
    is_duplicate: Mapped[bool] = mapped_column(default=False)  # Flagged as duplicate?
    parent_report_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Link to original if duplicate
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
