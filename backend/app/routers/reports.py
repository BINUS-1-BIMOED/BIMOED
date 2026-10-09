from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from ml.report_validator import ReportValidator
from models.report import Report
from schemas import ReportCreate, ReportResponse, ReportValidationResponse
from services.storage import StorageService
from utils.geo import bounding_box, haversine_km

router = APIRouter(prefix="/reports", tags=["reports"])
validator = ReportValidator()
storage = StorageService()

# Public-facing upload: restrict to real image types and a sane size so an arbitrary
# file (e.g. SVG/HTML with embedded script) can't be stored and served back from our
# public photo URLs.
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 8 * 1024 * 1024  # 8 MB


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
):
    report = Report(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)

    status, confidence, _ = validator.validate(db, report)
    report.validation_status = status
    report.confidence = confidence
    db.commit()
    db.refresh(report)
    return report


@router.post("/upload", response_model=ReportResponse, status_code=201)
async def create_report_with_photo(
    category: str = Form(...),
    severity: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    description: str = Form(""),
    user_id: str | None = Form(None),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if photo.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Photo must be JPEG, PNG, or WEBP")

    content = await photo.read()
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Photo must be smaller than 8 MB")

    photo_url = storage.upload_report_photo(photo.filename or "photo.jpg", content, photo.content_type)

    report = Report(
        category=category,
        severity=severity,
        lat=lat,
        lng=lng,
        description=description,
        user_id=user_id,
        photo_url=photo_url,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    status, confidence, _ = validator.validate(db, report)
    report.validation_status = status
    report.confidence = confidence
    db.commit()
    db.refresh(report)
    return report


@router.get("/nearby", response_model=list[ReportResponse])
def nearby_reports(
    lat: float,
    lng: float,
    radius_km: float = 5,
    db: Session = Depends(get_db),
):
    lat_min, lat_max, lng_min, lng_max = bounding_box(lat, lng, radius_km)
    reports = (
        db.query(Report)
        .filter(Report.lat.between(lat_min, lat_max), Report.lng.between(lng_min, lng_max))
        .order_by(Report.created_at.desc())
        .all()
    )
    return [r for r in reports if haversine_km(lat, lng, r.lat, r.lng) <= radius_km]


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{report_id}/validation", response_model=ReportValidationResponse)
def get_report_validation(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    status, confidence, reasons = validator.validate(db, report)
    report.validation_status = status
    report.confidence = confidence
    db.commit()

    return ReportValidationResponse(
        report_id=report.id,
        validation_status=status,
        confidence=confidence,
        reasons=reasons,
    )
