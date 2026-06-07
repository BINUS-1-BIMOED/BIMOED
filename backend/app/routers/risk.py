from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from ml.risk_scorer import RiskScorer
from schemas import RiskHistoryPoint, RiskHistoryResponse, RiskResponse
from services.weather import WeatherService

router = APIRouter(prefix="/risk", tags=["risk"])
scorer = RiskScorer()
weather_service = WeatherService()


@router.get("", response_model=RiskResponse)
async def get_risk(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
):
    cached = weather_service.get_cached(db, lat, lng)
    if cached and "current" in cached:
        open_meteo = cached
        bmkg = weather_service._bmkg_fallback(lat, lng)
    else:
        open_meteo = await weather_service.fetch_open_meteo(lat, lng)
        bmkg = await weather_service.fetch_bmkg(lat, lng)
        weather_service.cache_weather(db, lat, lng, "open_meteo", open_meteo)
        weather_service.cache_weather(db, lat, lng, "bmkg", bmkg)

    metrics = weather_service.extract_metrics(open_meteo, bmkg)
    result = scorer.compute(db, lat, lng, metrics["rainfall_mm"], metrics["river_discharge"])
    return RiskResponse(**result)


@router.get("/history", response_model=RiskHistoryResponse)
async def get_risk_history(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    hours: int = Query(12, ge=1, le=48),
    db: Session = Depends(get_db),
):
    open_meteo = await weather_service.fetch_open_meteo(lat, lng)
    bmkg = await weather_service.fetch_bmkg(lat, lng)
    metrics = weather_service.extract_metrics(open_meteo, bmkg)
    points = [
        RiskHistoryPoint(hour=p["hour"], rainfall_mm=p["rainfall_mm"])
        for p in metrics["history"][:hours]
    ]
    if not points:
        points = [RiskHistoryPoint(hour=i, rainfall_mm=max(0, metrics["rainfall_mm"] - i * 2)) for i in range(hours)]
    return RiskHistoryResponse(points=points)
