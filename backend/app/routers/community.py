from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models.report import Report
from models.community_validation import CommunityValidation
from schemas import CommunityValidationCreate, CommunityValidationResponse
from services.trust_score import TrustScoreService

router = APIRouter(prefix="/community", tags=["community"])


@router.post("/validate", response_model=CommunityValidationResponse, status_code=201)
def submit_validation(
    payload: CommunityValidationCreate,
    db: Session = Depends(get_db),
):
    """Submit community validation for a report"""
    # Check if report exists
    report = db.query(Report).filter(Report.id == payload.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Check for duplicate validation from same user
    existing = db.query(CommunityValidation).filter(
        CommunityValidation.report_id == payload.report_id,
        CommunityValidation.user_id == payload.user_id,
    ).first()

    if existing:
        # Update existing validation instead
        for key, value in payload.model_dump().items():
            if value is not None:
                setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
    else:
        # Create new validation
        existing = CommunityValidation(**payload.model_dump())
        db.add(existing)

    db.commit()
    db.refresh(existing)

    # Recalculate report's community validation score
    validation_score = TrustScoreService.get_community_validation_score(db, payload.report_id)
    report.validation_score = validation_score
    db.commit()

    return existing


@router.get("/validate/{report_id}", response_model=list[CommunityValidationResponse])
def get_report_validations(
    report_id: int,
    db: Session = Depends(get_db),
):
    """Get all validations for a specific report"""
    validations = db.query(CommunityValidation).filter(
        CommunityValidation.report_id == report_id
    ).all()
    return validations


@router.get("/duplicates", response_model=dict)
def check_for_duplicates(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    category: str = Query(...),
    db: Session = Depends(get_db),
):
    """Check if there's a potential duplicate report nearby"""
    duplicate_id = TrustScoreService.detect_duplicate_reports(db, lat, lng, category)
    
    if duplicate_id:
        report = db.query(Report).filter(Report.id == duplicate_id).first()
        return {
            "is_duplicate": True,
            "duplicate_report_id": duplicate_id,
            "message": f"Similar report found {duplicate_id}",
        }
    
    return {"is_duplicate": False}


@router.post("/mark-duplicate/{report_id}")
def mark_as_duplicate(
    report_id: int,
    parent_report_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Mark a report as duplicate of another"""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    parent = db.query(Report).filter(Report.id == parent_report_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent report not found")

    report.is_duplicate = True
    report.parent_report_id = parent_report_id
    db.commit()

    return {"message": "Report marked as duplicate"}
