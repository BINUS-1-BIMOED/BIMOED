from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import os
from .utils.model_loader import ModelLoader
from .utils.trust import calculate_trust
from .utils.denoise import denoise_image_bytes
from .utils.cooldown import CooldownManager
from .models import ReportIn, ReportOut, SOSIn, PredictIn
import requests
import json

app = FastAPI(title="BIMOED Backend POC")

DATA_DIR = os.environ.get("DATA_DIR","data")
os.makedirs(DATA_DIR, exist_ok=True)

# default PKL path set to where user indicated the PKL resides in repo
model_loader = ModelLoader(
    pkl_path=os.environ.get("PKL_PATH","backend/app/ml/models/flood_model.pkl"),
    joblib_path=os.environ.get("JOBLIB_PATH","backend/app/ml/models/flood_model.joblib"),
)

cooldown = CooldownManager()

ALERTS_JSON = os.path.join(DATA_DIR, "flood_alerts.json")
REPORTS_JSON = os.path.join(DATA_DIR, "reports.json")

def save_json(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)

def load_json(path):
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)

@app.post("/predict")
def predict(payload: PredictIn):
    features = payload.features
    try:
        score, metadata = model_loader.predict_dict(features)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"flood_risk_score": score, "model": metadata}

@app.post("/reports", response_model=ReportOut)
def submit_report(report: ReportIn):
    # compute trust components (placeholder heuristics)
    user_history_accuracy = report.user_history_accuracy or 0.5
    geographical_consistency = 1.0 if report.lat and report.lon else 0.0
    report_clustering = 0.0  # would be computed from spatial clustering
    temporal_pattern = 0.5
    trust = calculate_trust(user_history_accuracy, geographical_consistency, report_clustering, temporal_pattern)
    out = report.dict()
    out.update({"trust_score": trust})
    reports = load_json(REPORTS_JSON)
    reports.append(out)
    save_json(REPORTS_JSON, reports)
    return out

@app.post("/sos")
def sos(sos_in: SOSIn):
    # cooldown check
    if not cooldown.can_send(sos_in.user_id, sos_in.lat, sos_in.lon):
        raise HTTPException(status_code=429, detail="Cooldown active for this user/location")
    # simple validation: check if any flood alert covers location (naive)
    alerts = load_json(ALERTS_JSON)
    matched = False
    for a in alerts:
        # attempt simple bounding box match if geometry provided
        geom = a.get("geometry")
        if geom and sos_in.lat and sos_in.lon:
            # naive: if point inside bbox
            coords = geom.get("coordinates")
            if coords and isinstance(coords, list) and len(coords) >= 2:
                # expecting [lon, lat]
                lon_a, lat_a = coords[0], coords[1]
                if abs(lat_a - sos_in.lat) < 0.1 and abs(lon_a - sos_in.lon) < 0.1:
                    matched = True
    # store sos event
    sos_record = sos_in.dict()
    sos_record.update({"validated_by_alert": matched})
    reports = load_json(REPORTS_JSON)
    reports.append(sos_record)
    save_json(REPORTS_JSON, reports)
    return {"accepted": True, "validated": matched}

@app.post("/denoise-image")
def denoise_image(file: UploadFile = File(...)):
    content = file.file.read()
    out_bytes = denoise_image_bytes(content)
    out_path = os.path.join(DATA_DIR, f"denoised_{file.filename}")
    with open(out_path, "wb") as f:
        f.write(out_bytes)
    return FileResponse(out_path, media_type="image/jpeg")

@app.post("/sync-flood-alerts")
def sync_flood_alerts():
    # Fetch from data.gov.sg flood alerts API (if available)
    url = "https://api.data.gov.sg/v1/environment/flood-availability"  # fallback endpoint
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        save_json(ALERTS_JSON, data.get("items", data))
        return {"synced": True, "count": len(load_json(ALERTS_JSON))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
