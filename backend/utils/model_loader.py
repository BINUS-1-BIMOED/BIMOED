import pickle
import joblib
import numpy as np
import os

class ModelLoader:
    def __init__(self, pkl_path=None, joblib_path=None):
        # default to repository path where user placed the PKL
        self.pkl_path = pkl_path or os.environ.get("PKL_PATH", "backend/app/ml/models/flood_model.pkl")
        self.joblib_path = joblib_path or os.environ.get("JOBLIB_PATH", "backend/app/ml/models/flood_model.joblib")
        self.pkl_model = None
        self.joblib_model = None
        self._load_models()

    def _load_models(self):
        # load primary pickle model (may be xgboost or sklearn)
        if os.path.exists(self.pkl_path):
            try:
                with open(self.pkl_path, "rb") as f:
                    self.pkl_model = pickle.load(f)
            except Exception as e:
                # raise with context so caller can report
                raise RuntimeError(f"Failed to unpickle PKL model at {self.pkl_path}: {e}")
        if os.path.exists(self.joblib_path):
            try:
                self.joblib_model = joblib.load(self.joblib_path)
            except Exception as e:
                # non-fatal: keep None but log
                print(f"Warning: failed to load joblib fallback at {self.joblib_path}: {e}")

    def _predict_proba(self, model, X):
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X)
            if probs.ndim == 1:
                return probs
            if probs.shape[1] >= 2:
                return probs[:,1]
            return probs.ravel()
        else:
            # some models (e.g., xgboost XGBClassifier) expose predict_proba as method too; fallback to predict
            return model.predict(X)

    def predict(self, X):
        # X: 2D numpy array
        if self.pkl_model is None:
            raise RuntimeError("Primary PKL model not found")
        p1 = self._predict_proba(self.pkl_model, X)
        if self.joblib_model is not None:
            p2 = self._predict_proba(self.joblib_model, X)
            final = 0.85 * p1 + 0.15 * p2
        else:
            final = p1
        return final

    def predict_dict(self, features: dict):
        # convert dict to 2D array in deterministic order
        keys = sorted(features.keys())
        X = np.array([[features[k] for k in keys]], dtype=float)
        score = float(self.predict(X)[0])
        meta = {"primary": os.path.basename(self.pkl_path), "secondary": os.path.basename(self.joblib_path) if os.path.exists(self.joblib_path) else None}
        return score, meta
