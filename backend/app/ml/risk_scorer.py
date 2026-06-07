from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ml.flood_predictor import FloodPredictor
from models.historical_flood import HistoricalFlood
from models.report import Report
from models.risk_score import RiskScore
from utils.geo import haversine_km, risk_label


class RiskScorer:
    def __init__(self) -> None:
        self.predictor = FloodPredictor()

    def historical_factor(self, db: Session, lat: float, lng: float) -> float:
        floods = db.query(HistoricalFlood).all()
        if not floods:
            return 0.5
        weights = []
        for f in floods:
            dist = haversine_km(lat, lng, f.lat, f.lng)
            if dist <= 15:
                sev = {"low": 0.2, "moderate": 0.5, "high": 0.75, "critical": 0.95}.get(f.severity, 0.5)
                weights.append(sev * max(0.1, 1 - dist / 15))
        return min(1.0, sum(weights) / max(len(weights), 1)) if weights else 0.3

    def report_density_factor(self, db: Session, lat: float, lng: float) -> float:
        reports = db.query(Report).filter(Report.validation_status.in_(["verified", "pending"])).all()
        nearby = [r for r in reports if haversine_km(lat, lng, r.lat, r.lng) <= 3]
        if not nearby:
            return 0.0
        sev_map = {"low": 10, "moderate": 25, "high": 45, "critical": 65}
        return min(100, sum(sev_map.get(r.severity, 15) for r in nearby) / max(len(nearby), 1))

    def compute(
        self,
        db: Session,
        lat: float,
        lng: float,
        rainfall_mm: float,
        river_discharge: float,
        persist: bool = True,
    ) -> dict:
        hist = self.historical_factor(db, lat, lng)
        model_score = self.predictor.predict(rainfall_mm, river_discharge, lat, lng, hist)
        report_factor = self.report_density_factor(db, lat, lng)
        from services.geospatial import estimate_elevation

        elevation_m = estimate_elevation(lat, lng)
        rainfall_factor = min(100, rainfall_mm * 0.9)
        elevation_factor = max(0, 30 - elevation_m)

        score = (
            0.40 * model_score
            + 0.30 * rainfall_factor
            + 0.20 * report_factor
            + 0.10 * elevation_factor
        )
        score = round(min(99, max(5, score)), 1)
        water_level = round(rainfall_mm * 0.015 + river_discharge * 0.002, 2)
        computed_at = datetime.now(timezone.utc)

        if persist:
            row = RiskScore(
                lat=lat,
                lng=lng,
                score=score,
                rainfall_mm=rainfall_mm,
                river_discharge=river_discharge,
                elevation_m=elevation_m,
                computed_at=computed_at,
            )
            db.add(row)
            db.commit()

        return {
            "score": score,
            "label": risk_label(score),
            "rainfall_mm": rainfall_mm,
            "water_level_m": water_level,
            "river_discharge": river_discharge,
            "elevation_m": elevation_m,
            "computed_at": computed_at,
        }
