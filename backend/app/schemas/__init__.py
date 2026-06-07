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
