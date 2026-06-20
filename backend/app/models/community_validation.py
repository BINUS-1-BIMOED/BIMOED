from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class CommunityValidation(Base):
    __tablename__ = "escood_community_validations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verdict: Mapped[str] = mapped_column(String(16), default="uncertain")  # accurate, inaccurate, duplicate, uncertain
    confidence: Mapped[float] = mapped_column(Float, default=0.5)  # 0-1: how confident about this verdict
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    
