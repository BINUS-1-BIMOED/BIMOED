from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from config import settings
from services.geospatial import estimate_elevation


class FloodPredictor:
    def __init__(self) -> None:
        self.model_path = Path(settings.model_path)
        self.model: RandomForestRegressor | None = None
        self._load_or_train()

    def _load_or_train(self) -> None:
        if self.model_path.exists():
            self.model = joblib.load(self.model_path)
            return
        self.model = self._train_default_model()
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, self.model_path)

    def _train_default_model(self) -> RandomForestRegressor:
        rng = np.random.default_rng(42)
        rows = []
        medan_points = [
            (3.5952, 98.6722, "Medan Helvetia", 85),
            (3.5214, 98.6731, "Medan Denai", 78),
            (3.6123, 98.6345, "Medan Tuntungan", 72),
            (3.5841, 98.7012, "Medan Johor", 65),
            (3.5678, 98.6555, "Medan Polonia", 55),
        ]
        for lat, lng, _, hist_sev in medan_points:
            for _ in range(40):
                rainfall = rng.uniform(10, 120)
                discharge = rng.uniform(50, 400)
                elev = estimate_elevation(lat + rng.normal(0, 0.01), lng + rng.normal(0, 0.01))
                hist = hist_sev / 100
                score = min(99, max(5, rainfall * 0.35 + discharge * 0.08 - elev * 1.2 + hist * 30 + rng.normal(0, 3)))
                rows.append({"rainfall_mm": rainfall, "river_discharge": discharge, "elevation_m": elev, "historical_factor": hist, "score": score})

        df = pd.DataFrame(rows)
        model = RandomForestRegressor(n_estimators=80, random_state=42)
        model.fit(df[["rainfall_mm", "river_discharge", "elevation_m", "historical_factor"]], df["score"])
        return model

    def predict(self, rainfall_mm: float, river_discharge: float, lat: float, lng: float, historical_factor: float = 0.5) -> float:
        elev = estimate_elevation(lat, lng)
        features = np.array([[rainfall_mm, river_discharge, elev, historical_factor]])
        pred = float(self.model.predict(features)[0]) if self.model else 50.0
        return round(min(99, max(5, pred)), 1)
