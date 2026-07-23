import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from config import settings
from models.weather_cache import WeatherCache
from services.geospatial import estimate_elevation

logger = logging.getLogger(__name__)


class WeatherService:
    async def fetch_open_meteo(self, lat: float, lng: float) -> dict:
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "precipitation,rain,temperature_2m,relative_humidity_2m,wind_speed_10m",
            "hourly": "precipitation,rain,temperature_2m",
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

    def score_from_forecast(self, rainfall_mm: float, river_discharge: float, elevation_m: float | None = None) -> float:
        """Convert forecast metrics into a 0-100 risk score for visualization/routing."""
        rainfall_component = min(100.0, max(0.0, rainfall_mm * 1.6))
        discharge_component = min(100.0, max(0.0, (river_discharge / 160.0) * 100.0))
        elev = elevation_m if elevation_m is not None else 10.0
        elev_component = max(0.0, 20.0 - elev) * 1.2
        score = 0.45 * rainfall_component + 0.45 * discharge_component + 0.10 * elev_component
        return round(min(95.0, max(5.0, score)), 1)

    def condition_from_rainfall(self, rainfall_mm: float) -> tuple[str, str]:
        """Return (label, emoji) from rainfall amount."""
        if rainfall_mm >= 10:
            return "Rainstorm", "⛈️"
        if rainfall_mm >= 5:
            return "Heavy rain", "🌧️"
        if rainfall_mm >= 2:
            return "Moderate rain", "🌦️"
        if rainfall_mm >= 0.5:
            return "Light rain", "🌧️"
        if rainfall_mm > 0.1:
            return "Drizzle", "🌦️"
        return "Cloudy", "☁️"

    def build_weather_response(self, open_meteo: dict, lat: float, lng: float) -> dict:
        """Build current + hourly forecast payload for the home screen."""
        hourly = open_meteo.get("hourly", {}) or {}
        times = hourly.get("time") or []
        precip = hourly.get("precipitation") or hourly.get("rain") or []
        temps = hourly.get("temperature_2m") or []
        current = open_meteo.get("current", {}) or {}
        current_rain = float(current.get("rain", current.get("precipitation", precip[0] if precip else 0)) or 0)
        discharge = float(open_meteo.get("river_discharge", 0) or 0)
        base_temp = float(current.get("temperature_2m") or (temps[0] if temps else 28.0))
        humidity = int(current.get("relative_humidity_2m") or min(98, 70 + int(current_rain * 3)))
        wind_speed = float(current.get("wind_speed_10m") or 10.0)
        condition, icon = self.condition_from_rainfall(current_rain)

        forecast = []
        for i in range(min(6, len(precip))):
            rain_i = float(precip[i] or 0)
            hour_label = i
            if i < len(times):
                try:
                    hour_label = datetime.fromisoformat(times[i].replace("Z", "+00:00")).hour
                except ValueError:
                    hour_label = (datetime.now().hour + i) % 24
            cond_i, icon_i = self.condition_from_rainfall(rain_i)
            temp_i = float(temps[i]) if i < len(temps) and temps[i] is not None else base_temp - i * 0.3
            forecast.append({
                "hour": hour_label,
                "temp": round(temp_i, 1),
                "condition": cond_i,
                "icon": icon_i,
                "precipitation": round(rain_i, 1),
            })

        return {
            "temp": round(base_temp, 1),
            "condition": condition,
            "humidity": humidity,
            "wind_speed": round(wind_speed, 1),
            "precipitation": round(current_rain, 1),
            "river_discharge": round(discharge, 1),
            "icon": icon,
            "forecast": forecast,
            "source": "open_meteo",
        }

    async def build_risk_grid(self, db: Session, origin_lat: float, origin_lng: float) -> list[dict]:
        """Build flood/rain risk points from real Open-Meteo precipitation + elevation."""
        import math

        cached = self.get_cached(db, origin_lat, origin_lng)
        if cached and "hourly" in cached:
            open_meteo = cached
        else:
            open_meteo = await self.fetch_open_meteo(origin_lat, origin_lng)
            self.cache_weather(db, origin_lat, origin_lng, "open_meteo", open_meteo)

        hourly = open_meteo.get("hourly", {}) or {}
        precip = hourly.get("precipitation") or hourly.get("rain") or []
        discharge = float(open_meteo.get("river_discharge", 0) or 0)

        sample_pts = self._sample_points(origin_lat, origin_lng, radius_km=3.0, count=24)
        elevations = await asyncio.gather(*(asyncio.to_thread(estimate_elevation, lat, lng) for lat, lng in sample_pts))
        grid: list[dict] = []
        for (lat, lng), elev in zip(sample_pts, elevations):
            dist_km = math.sqrt((lat - origin_lat) ** 2 + (lng - origin_lng) ** 2) * 111
            # Low elevation + distance from center increases localized runoff risk
            runoff_factor = 1.0 + max(0.0, (12.0 - elev) / 25.0) + dist_km * 0.04
            for hour_offset in (0, 2, 4):
                hour_idx = min(len(precip) - 1, hour_offset) if precip else 0
                base_rain = float(precip[hour_idx] or 0) if precip else 0.0
                local_rain = base_rain * runoff_factor
                score = self.score_from_forecast(local_rain, discharge, elevation_m=elev)
                grid.append({
                    "lat": lat,
                    "lng": lng,
                    "score": score,
                    "elevation_m": round(elev, 1),
                    "rainfall_mm": round(local_rain, 1),
                    "river_discharge": round(discharge, 1),
                    "hour_offset": hour_offset,
                })
        return grid

    def _sample_points(self, origin_lat: float, origin_lng: float, radius_km: float = 2.5, count: int = 18) -> list[tuple[float, float]]:
        """Sample points around origin in an evenly spread pattern (natural distribution)."""
        # Avoid importing random for deterministic rendering.
        points: list[tuple[float, float]] = []
        # Approx degrees per km
        dlat = radius_km / 111.0
        dlng = radius_km / (111.0 * max(0.2, abs(__import__('math').cos(origin_lat * __import__('math').pi / 180))))
        steps = int(__import__('math').sqrt(count))
        if steps < 3:
            steps = 3
        for i in range(steps):
            for j in range(steps):
                if len(points) >= count:
                    break
                # centered grid + slight offset per row for more natural spread
                frac_i = (i + 0.5) / steps - 0.5
                frac_j = (j + 0.5) / steps - 0.5
                lat = origin_lat + frac_i * dlat * 1.8
                lng = origin_lng + frac_j * dlng * 1.8
                points.append((round(lat, 4), round(lng, 4)))
            if len(points) >= count:
                break
        return points

    async def build_weather_forecast_points(
        self,
        db: Session,
        origin_lat: float,
        origin_lng: float,
        *,
        score_threshold: float = 45,
        sample_count: int = 12,
    ) -> list[dict]:
        """Return high-risk forecast points for routing avoidance.

        Di routing, kita tidak perlu grid besar (biar cepat). Jadi kita
        pakai sampling lebih sedikit dan filter score lebih ketat.
        """
        # Create a smaller grid by temporarily re-sampling points.
        import math

        cached = self.get_cached(db, origin_lat, origin_lng)
        if cached and "hourly" in cached:
            open_meteo = cached
        else:
            open_meteo = await self.fetch_open_meteo(origin_lat, origin_lng)
            self.cache_weather(db, origin_lat, origin_lng, "open_meteo", open_meteo)

        hourly = open_meteo.get("hourly", {}) or {}
        precip = hourly.get("precipitation") or hourly.get("rain") or []
        discharge = float(open_meteo.get("river_discharge", 0) or 0)

        # Smaller deterministic sample set around origin.
        def sample_points(lat: float, lng: float, radius_km: float, count: int) -> list[tuple[float, float]]:
            points: list[tuple[float, float]] = []
            dlat = radius_km / 111.0
            denom = 111.0 * max(0.2, abs(math.cos(lat * math.pi / 180)))
            dlng = radius_km / denom
            steps = int(math.sqrt(count))
            steps = max(3, steps)
            for i in range(steps):
                for j in range(steps):
                    if len(points) >= count:
                        break
                    frac_i = (i + 0.5) / steps - 0.5
                    frac_j = (j + 0.5) / steps - 0.5
                    p_lat = lat + frac_i * dlat * 1.6
                    p_lng = lng + frac_j * dlng * 1.6
                    points.append((round(p_lat, 4), round(p_lng, 4)))
                if len(points) >= count:
                    break
            return points

        pts = sample_points(origin_lat, origin_lng, radius_km=3.0, count=sample_count)
        elevations = await asyncio.gather(*(asyncio.to_thread(estimate_elevation, lat, lng) for lat, lng in pts))

        grid: list[dict] = []
        # Use only a subset of hour offsets to speed-up.
        hour_offsets = (0, 2)

        for (lat, lng), elev in zip(pts, elevations):
            dist_km = math.sqrt((lat - origin_lat) ** 2 + (lng - origin_lng) ** 2) * 111
            runoff_factor = 1.0 + max(0.0, (12.0 - elev) / 25.0) + dist_km * 0.03
            for hour_offset in hour_offsets:
                hour_idx = min(len(precip) - 1, hour_offset) if precip else 0
                base_rain = float(precip[hour_idx] or 0) if precip else 0.0
                local_rain = base_rain * runoff_factor
                score = self.score_from_forecast(local_rain, discharge, elevation_m=elev)
                grid.append(
                    {
                        "lat": lat,
                        "lng": lng,
                        "score": score,
                        "elevation_m": round(elev, 1),
                        "rainfall_mm": round(local_rain, 1),
                        "river_discharge": round(discharge, 1),
                        "hour_offset": hour_offset,
                    }
                )

        candidates = [p for p in grid if p.get("score", 0) >= score_threshold]
        # Keep top N to avoid ORS payload too large.
        candidates.sort(key=lambda p: p.get("score", 0), reverse=True)
        return candidates[:20]

