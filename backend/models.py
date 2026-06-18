from pydantic import BaseModel
from typing import Optional, Dict, Any

class PredictIn(BaseModel):
    features: Dict[str, float]

class ReportIn(BaseModel):
    user_id: str
    lat: Optional[float]
    lon: Optional[float]
    description: Optional[str]
    user_history_accuracy: Optional[float]

class ReportOut(ReportIn):
    trust_score: float

class SOSIn(BaseModel):
    user_id: str
    age: Optional[int]
    is_disabled: Optional[bool]
    urgency: str
    lat: Optional[float]
    lon: Optional[float]
    notes: Optional[str]
