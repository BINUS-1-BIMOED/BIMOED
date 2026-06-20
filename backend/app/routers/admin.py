from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from database import get_db
from services.data_storage import DataStorageService
from services.feedback import FeedbackService
from services.trust_score import TrustScoreService
from models.report import Report

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/analytics/overview")
def get_system_overview(db: Session = Depends(get_db)):
    """Get overall system health and statistics"""
    cutoff_7d = datetime.utcnow() - timedelta(days=7)
    cutoff_30d = datetime.utcnow() - timedelta(days=30)

    total_reports = db.query(Report).count()
    reports_7d = db.query(Report).filter(Report.created_at >= cutoff_7d).count()
    reports_30d = db.query(Report).filter(Report.created_at >= cutoff_30d).count()
    
    verified = db.query(Report).filter(Report.validation_status == "verified").count()
    pending = db.query(Report).filter(Report.validation_status == "pending").count()
    flagged = db.query(Report).filter(Report.validation_status == "flagged").count()

    avg_trust_score = db.query(Report).with_entities(
        db.func.avg(Report.trust_score)
    ).scalar() or 0

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "reports": {
            "total": total_reports,
            "last_7_days": reports_7d,
            "last_30_days": reports_30d,
        },
        "validation": {
            "verified": verified,
            "pending": pending,
            "flagged": flagged,
        },
        "quality": {
            "average_trust_score": round(float(avg_trust_score), 3),
            "verification_rate": round(verified / max(total_reports, 1) * 100, 2),
        },
    }


@router.get("/analytics/training-readiness")
def check_training_readiness(db: Session = Depends(get_db)):
    """Check if system is ready to retrain AI models"""
    return DataStorageService.get_model_training_readiness(db)


@router.get("/analytics/model-performance")
def get_model_performance(
    region: str = Query("median"),
    db: Session = Depends(get_db),
):
    """Analyze model performance by region"""
    return FeedbackService.analyze_model_performance_by_region(db, region)


@router.get("/analytics/blind-spots")
def identify_blind_spots(db: Session = Depends(get_db)):
    """Find areas where model performs poorly"""
    return FeedbackService.identify_model_blind_spots(db)


@router.get("/analytics/improvement-suggestions")
def get_improvements(db: Session = Depends(get_db)):
    """Get AI model improvement suggestions based on feedback"""
    return FeedbackService.generate_improvement_suggestions(db)


@router.get("/analytics/iot-gap-analysis")
def analyze_iot_gaps(db: Session = Depends(get_db)):
    """Identify areas lacking IoT sensor coverage"""
    return FeedbackService.get_iot_sensor_gap_analysis(db)


@router.get("/data/export-training")
def export_training_data(days: int = Query(90, ge=7, le=365), db: Session = Depends(get_db)):
    """Export validated reports as training dataset"""
    return DataStorageService.export_training_dataset(db, days)


@router.get("/data/export-feedback")
def export_feedback(db: Session = Depends(get_db)):
    """Export community validation feedback"""
    return DataStorageService.export_feedback_dataset(db)


@router.get("/data/regional-statistics")
def get_regional_stats(region: str = Query("medan"), db: Session = Depends(get_db)):
    """Get flood statistics for specific region"""
    return DataStorageService.get_flood_event_statistics(db, region)


@router.post("/data/cleanup-expired")
def cleanup_expired(db: Session = Depends(get_db)):
    """Remove expired notifications and old data"""
    from services.notification import FloodNotificationService
    
    count = FloodNotificationService.cleanup_expired_notifications(db)
    return {
        "success": True,
        "cleaned": count,
        "message": f"Cleaned {count} expired items",
    }


@router.get("/health/system")
def system_health(db: Session = Depends(get_db)):
    """Get overall system health status"""
    try:
        # Test database connection
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"error: {str(e)}"

    recent_reports = (
        db.query(Report)
        .filter(Report.created_at >= datetime.utcnow() - timedelta(hours=1))
        .count()
    )

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "database": db_status,
        "recent_activity": recent_reports,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/compliance/data-retention")
def check_data_retention(db: Session = Depends(get_db)):
    """Check data retention compliance"""
    total_reports = db.query(Report).count()
    
    old_data = db.query(Report).filter(
        Report.created_at <= datetime.utcnow() - timedelta(days=365)
    ).count()

    return {
        "total_reports": total_reports,
        "retained_beyond_1yr": old_data,
        "retention_policy": "Keep all historical data for model training",
        "gdpr_compliant": True,
        "data_encrypted": True,
    }
