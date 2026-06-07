import logging

from sqlalchemy.orm import Session

from ml.risk_scorer import RiskScorer
from models.alert import Alert
from services.geospatial import estimate_elevation
from services.weather import WeatherService

logger = logging.getLogger(__name__)


class DataCollector:
    def __init__(self) -> None:
        self.weather = WeatherService()
        self.scorer = RiskScorer()

    async def refresh_location(self, db: Session, lat: float, lng: float) -> dict:
        open_meteo = await self.weather.fetch_open_meteo(lat, lng)
        bmkg = await self.weather.fetch_bmkg(lat, lng)
        self.weather.cache_weather(db, lat, lng, "open_meteo", open_meteo)
        self.weather.cache_weather(db, lat, lng, "bmkg", bmkg)

        metrics = self.weather.extract_metrics(open_meteo, bmkg)
        risk = self.scorer.compute(
            db,
            lat,
            lng,
            metrics["rainfall_mm"],
            metrics["river_discharge"],
            persist=True,
        )

        if risk["score"] >= 60:
            existing = (
                db.query(Alert)
                .filter(Alert.lat.between(lat - 0.01, lat + 0.01), Alert.lng.between(lng - 0.01, lng + 0.01))
                .count()
            )
            if existing == 0:
                db.add(
                    Alert(
                        title="Elevated Flood Risk Detected",
                        location=f"Grid {lat:.3f}, {lng:.3f}",
                        lat=lat,
                        lng=lng,
                        severity="high" if risk["score"] < 80 else "critical",
                        source="ai_model",
                        description=f"Risk score {risk['score']} based on rainfall {metrics['rainfall_mm']:.1f}mm and discharge {metrics['river_discharge']:.1f}.",
                    )
                )
                db.commit()

        logger.info("Refreshed data for (%s, %s): score=%s", lat, lng, risk["score"])
        return {"metrics": metrics, "risk": risk, "elevation_m": estimate_elevation(lat, lng)}
