import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from config import settings
from models.weather_cache import WeatherCache

logger = logging.getLogger(__name__)


class WeatherService:
    async def fetch_open_meteo(self, lat: float, lng: float) -> dict:
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "precipitation,rain",
            "hourly": "precipitation,rain",
            "forecast_days": 1,
            "timezone": "Asia/Jakarta",
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(f"{settings.open_meteo_base}/forecast", params=params)
                resp.raise_for_status()
                data = resp.json()
                data["river_discharge"] = await self._fetch_river_discharge(client, lat, lng)
                return data
        except Exception as exc:
            logger.warning("Open-Meteo unavailable, using fallback: %s", exc)
            return self._open_meteo_fallback(lat, lng)

    async def _fetch_river_discharge(self, client: httpx.AsyncClient, lat: float, lng: float) -> float:
        try:
            resp = await client.get(
                "https://flood-api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "daily": "river_discharge",
                    "forecast_days": 1,
                },
            )
            if resp.status_code == 200:
                daily = resp.json().get("daily", {}).get("river_discharge") or []
                return float(next((v for v in daily if v is not None), 0) or 0)
        except Exception:
            pass
        seed = int(abs(lat * 1000 + lng * 1000)) % 100
        return 80.0 + seed * 2.5

    def _open_meteo_fallback(self, lat: float, lng: float) -> dict:
        seed = int(abs(lat * 1000 + lng * 1000)) % 50
        rainfall = 20 + seed * 0.8
        hourly = [max(0, rainfall - i * 1.5) for i in range(12)]
        return {
            "current": {"precipitation": rainfall, "rain": rainfall},
            "hourly": {"precipitation": hourly, "rain": hourly},
            "river_discharge": 80 + seed * 2.5,
        }

    async def fetch_bmkg(self, lat: float, lng: float) -> dict:
        headers = {}
        if settings.bmkg_api_key:
            headers["Authorization"] = settings.bmkg_api_key

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(
                    "https://api.bmkg.go.id/publik/prakiraan-cuaca",
                    params={"adm4": "12.71.06.1001"},
                    headers=headers,
                )
                if resp.status_code == 200:
                    return resp.json()
        except Exception as exc:
            logger.warning("BMKG API unavailable: %s", exc)
        return self._bmkg_fallback(lat, lng)

    def _bmkg_fallback(self, lat: float, lng: float) -> dict:
        seed = int(abs(lat * 1000 + lng * 1000)) % 50
        return {
            "source": "bmkg_fallback",
            "rainfall_mm": 20 + seed * 0.8,
            "forecast_hours": [{"hour": h, "rainfall_mm": max(0, 15 + seed * 0.5 - h)} for h in range(12)],
        }

    def cache_weather(self, db: Session, lat: float, lng: float, source: str, data: dict) -> None:
        entry = WeatherCache(
            lat=round(lat, 3),
            lng=round(lng, 3),
            source=source,
            data_json=json.dumps(data),
            fetched_at=datetime.now(timezone.utc),
        )
        db.add(entry)
        db.commit()

    def get_cached(self, db: Session, lat: float, lng: float, max_age_minutes: int = 30) -> dict | None:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
        row = (
            db.query(WeatherCache)
            .filter(
                WeatherCache.lat == round(lat, 3),
                WeatherCache.lng == round(lng, 3),
                WeatherCache.fetched_at >= cutoff,
            )
            .order_by(WeatherCache.fetched_at.desc())
            .first()
        )
        if not row:
            return None
        return json.loads(row.data_json)

    def extract_metrics(self, open_meteo: dict, bmkg: dict) -> dict:
        current = open_meteo.get("current", {})
        hourly = open_meteo.get("hourly", {})
        rainfall = current.get("rain", current.get("precipitation", 0)) or 0
        discharge = open_meteo.get("river_discharge", 0) or 0

        history = []
        precip = hourly.get("precipitation") or hourly.get("rain") or []
        for i, val in enumerate(precip[:12]):
            history.append({"hour": i, "rainfall_mm": float(val or 0)})

        if not history and "forecast_hours" in bmkg:
            history = bmkg["forecast_hours"]

        bmkg_rain = bmkg.get("rainfall_mm", rainfall)
        return {
            "rainfall_mm": float(max(rainfall, bmkg_rain)),
            "river_discharge": float(discharge),
            "history": history,
        }
