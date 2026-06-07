from datetime import datetime

from sqlalchemy import DateTime, Float, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RiskScore(Base):
    __tablename__ = "escood_risk_scores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    lng: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    rainfall_mm: Mapped[float] = mapped_column(Float, default=0.0)
    river_discharge: Mapped[float] = mapped_column(Float, default=0.0)
    elevation_m: Mapped[float] = mapped_column(Float, default=0.0)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
