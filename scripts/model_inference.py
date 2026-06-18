#!/usr/bin/env python3
import pandas as pd
import numpy as np
import os
import joblib
import pickle
from datetime import datetime

# default to where the repository places the PKL model
PKL_PATH = os.environ.get("PKL_PATH","backend/app/ml/models/flood_model.pkl")
JOBLIB_PATH = os.environ.get("JOBLIB_PATH","backend/app/ml/models/flood_model.joblib")
SAMPLE_FEATURES_CSV = os.environ.get("SAMPLE_FEATURES_CSV","data/sample_features.csv")
OUTPUT_CSV = os.environ.get("OUTPUT_CSV","output/predictions.csv")


def load_pkl_model(path):
    with open(path, "rb") as f:
        return pickle.load(f)


def load_joblib_model(path):
    return joblib.load(path)


def predict_batch(model, X):
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        if probs.shape[1] >= 2:
            return probs[:,1]
        return probs.ravel()
    else:
        return model.predict(X)


def main():
    print(f"[{datetime.utcnow()}] Loading PKL model from {PKL_PATH}")
    if not os.path.exists(PKL_PATH):
        raise SystemExit(f"PKL model not found at {PKL_PATH}. Please place your model there or set PKL_PATH env var.")
    pkl_model = load_pkl_model(PKL_PATH)
    secondary = None
    if os.path.exists(JOBLIB_PATH):
        print(f"[{datetime.utcnow()}] Loading joblib fallback from {JOBLIB_PATH}")
        secondary = load_joblib_model(JOBLIB_PATH)
    if not os.path.exists(SAMPLE_FEATURES_CSV):
        raise SystemExit(f"Sample features CSV not found at {SAMPLE_FEATURES_CSV}. Please provide sample_features.csv for inference tests.")
    df = pd.read_csv(SAMPLE_FEATURES_CSV)
    X = df.values.astype(float)
    p1 = predict_batch(pkl_model, X)
    if secondary is not None:
        p2 = predict_batch(secondary, X)
        final = 0.85 * p1 + 0.15 * p2
    else:
        final = p1
    df_out = df.copy()
    df_out["flood_risk_score"] = final
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    df_out.to_csv(OUTPUT_CSV, index=False)
    print(f"Wrote predictions to {OUTPUT_CSV}")

if __name__ == '__main__':
    main()
