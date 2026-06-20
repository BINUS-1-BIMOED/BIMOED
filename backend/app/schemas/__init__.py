from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


Severity = Literal["low", "moderate", "high", "critical"]
ValidationStatus = Literal["pending", "verified", "flagged"]
ReportCategory = Literal["flood", "landslide", "blockage", "evacuation", "safe_zone", "other"]


class ReportCreate(BaseModel):
    category: ReportCategory
    severity: Severity
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    description: str = ""
    user_id: str | None = None


class ReportResponse(BaseModel):
    id: int
    category: str
    severity: str
    lat: float
    lng: float
    description: str
    photo_url: str | None
    validation_status: str
    confidence: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportValidationResponse(BaseModel):
    report_id: int
    validation_status: ValidationStatus
    confidence: float
    reasons: list[str]


class AlertCreate(BaseModel):
    title: str
    location: str
    lat: float
    lng: float
    severity: Severity
    source: str = "system"
    description: str = ""


class AlertResponse(BaseModel):
    id: int
    title: str
    location: str
    lat: float
    lng: float
    severity: str
    source: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RiskResponse(BaseModel):
    score: float
    label: str
    rainfall_mm: float
    water_level_m: float
    river_discharge: float
    elevation_m: float
    computed_at: datetime


class RiskHistoryPoint(BaseModel):
    hour: int
    rainfall_mm: float


class RiskHistoryResponse(BaseModel):
    points: list[RiskHistoryPoint]


class SafeZoneResponse(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    capacity: int
    address: str
    distance_km: float | None = None

    model_config = {"from_attributes": True}


class EvacuationRouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float | None = None
    destination_lng: float | None = None


class RouteStep(BaseModel):
    instruction: str
    distance_m: float
    duration_s: float


class EvacuationRouteResponse(BaseModel):
    destination: SafeZoneResponse
    distance_km: float
    duration_min: float
    geometry: list[list[float]]
    steps: list[RouteStep]
    risk_penalty_applied: bool


class SyncBundleResponse(BaseModel):
    region: str
    safe_zones: list[SafeZoneResponse]
    recent_alerts: list[AlertResponse]
    risk_grid: list[dict]
    dem_tiles: list[dict]
    last_sync: datetime


class SOSCreate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    age: int = Field(..., ge=0, le=150)
    is_disabled: bool = False
    urgency: Literal["low", "medium", "critical"]
    user_id: str | None = None
    description: str = ""


class SOSResponse(BaseModel):
    id: int
    lat: float
    lng: float
    age: int
    is_disabled: bool
    urgency: str
    status: str
    user_id: str | None
    description: str
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class CommunityValidationCreate(BaseModel):
    report_id: int
    verdict: Literal["accurate", "inaccurate", "duplicate", "uncertain"]
    confidence: float = Field(0.5, ge=0, le=1)
    user_id: str | None = None
    notes: str | None = None


class CommunityValidationResponse(BaseModel):
    id: int
    report_id: int
    user_id: str | None
    verdict: str
    confidence: float
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FloodNotificationCreate(BaseModel):
    alert_type: Literal["flood", "warning", "watch", "advisory"]
    severity: Severity
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    location_name: str
    title: str
    description: str
    source: str
    radius_km: float = Field(10, ge=0.1, le=100)


class FloodNotificationResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    lat: float
    lng: float
    location_name: str
    radius_km: float
    title: str
    description: str
    source: str
    is_broadcast: bool
    broadcast_at: datetime | None
    users_notified: int
    created_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}
