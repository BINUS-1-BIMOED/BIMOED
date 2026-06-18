# BIMOED pkl-primary-runner branch

This branch adds a POC backend (FastAPI), frontend components, scripts, and CI workflow to:
- Use flood_model.pkl as the primary model for prediction
- Provide endpoints: /predict, /sos, /reports, /denoise-image, /sync-flood-alerts
- Add frontend UI components: WeatherCard, RainOverlay, SOSButton
- Add scripts for model inference and image denoise
- Add simple PWA manifest

How to run backend (dev):

1. cd backend
2. python3 -m venv .venv && source .venv/bin/activate
3. pip install -r requirements.txt
4. uvicorn backend_app:app --reload --port 8000

Place models/flood_model.pkl and optional models/flood_model.joblib in backend/models/
Place data/sample_features.csv for script tests

Notes:
- This is a functional prototype. Production hardening (Redis, Postgres/PostGIS, auth, rate-limits) is required.
