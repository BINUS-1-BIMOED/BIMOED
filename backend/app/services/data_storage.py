from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.report import Report
from models.alert import Alert
from models.historical_flood import HistoricalFlood
import json
import pandas as pd
from pathlib import Path


class DataStorageService:
    """
    Service for storing, managing, and exporting data for AI model training.
    Creates datasets from validated reports and feedback for continuous model improvement.
    """

    TRAINING_DATA_DIR = Path("training_data")
    VALIDATED_THRESHOLD = 0.7  # Only use reports with > 70% validation score

    @staticmethod
    def export_training_dataset(db: Session, days: int = 90) -> dict:
        """
        Export validated reports as training dataset.
        Includes features: location, severity, rainfall, trust_score, validation feedback.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get validated reports
        reports = (
            db.query(Report)
            .filter(
                Report.created_at >= cutoff_date,
                Report.validation_status == "verified",
                Report.validation_score >= DataStorageService.VALIDATED_THRESHOLD,
            )
            .all()
        )

        if not reports:
            return {"error": "No validated reports found", "data": []}

        training_data = []
        for report in reports:
            training_data.append({
                "id": report.id,
                "lat": report.lat,
                "lng": report.lng,
                "category": report.category,
                "severity": report.severity,
                "trust_score": report.trust_score,
                "validation_score": report.validation_score,
                "user_history_accuracy": report.user_history_accuracy,
                "geographical_consistency": report.geographical_consistency,
                "temporal_consistency": report.temporal_consistency,
                "description": report.description,
                "confidence": report.confidence,
                "created_at": report.created_at.isoformat(),
            })

        # Create pandas DataFrame
        df = pd.DataFrame(training_data)

        # Save as CSV and JSON
        csv_path = DataStorageService.TRAINING_DATA_DIR / f"training_data_{datetime.utcnow().date()}.csv"
        json_path = DataStorageService.TRAINING_DATA_DIR / f"training_data_{datetime.utcnow().date()}.json"

        csv_path.parent.mkdir(exist_ok=True)

        df.to_csv(csv_path, index=False)
        df.to_json(json_path, orient="records", date_format="iso")

        return {
            "success": True,
            "record_count": len(training_data),
            "csv_path": str(csv_path),
            "json_path": str(json_path),
            "features": list(df.columns),
            "summary_stats": df.describe().to_dict(),
        }

    @staticmethod
    def get_flood_event_statistics(db: Session, region: str, days: int = 90) -> dict:
        """
        Aggregate statistics about flood events in a region.
        Useful for understanding regional patterns.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get recent validated flood reports
        flood_reports = (
            db.query(Report)
            .filter(
                Report.created_at >= cutoff_date,
                Report.category == "flood",
                Report.validation_status == "verified",
            )
            .all()
        )

        # Get historical data
        historical = (
            db.query(HistoricalFlood)
            .filter(
                HistoricalFlood.flood_date >= cutoff_date.date(),
            )
            .all()
        )

        severity_counts = {
            "critical": sum(1 for r in flood_reports if r.severity == "critical"),
            "high": sum(1 for r in flood_reports if r.severity == "high"),
            "moderate": sum(1 for r in flood_reports if r.severity == "moderate"),
            "low": sum(1 for r in flood_reports if r.severity == "low"),
        }

        avg_trust_score = (
            sum(r.trust_score for r in flood_reports) / len(flood_reports)
            if flood_reports
            else 0
        )

        return {
            "region": region,
            "period_days": days,
            "recent_reports": len(flood_reports),
            "historical_events": len(historical),
            "severity_distribution": severity_counts,
            "average_trust_score": round(avg_trust_score, 3),
            "most_common_severity": max(
                severity_counts.items(), key=lambda x: x[1]
            )[0]
            if any(severity_counts.values())
            else "none",
        }

    @staticmethod
    def export_feedback_dataset(db: Session) -> dict:
        """
        Export community validation feedback for model retraining.
        This captures corrections and user insights that improve model accuracy.
        """
        from models.community_validation import CommunityValidation

        validations = db.query(CommunityValidation).all()

        feedback_data = []
        for v in validations:
            report = db.query(Report).filter(Report.id == v.report_id).first()
            if report:
                feedback_data.append({
                    "report_id": v.report_id,
                    "verdict": v.verdict,
                    "confidence": v.confidence,
                    "lat": report.lat,
                    "lng": report.lng,
                    "category": report.category,
                    "severity": report.severity,
                    "original_trust_score": report.trust_score,
                    "notes": v.notes,
                    "timestamp": v.created_at.isoformat(),
                })

        df = pd.DataFrame(feedback_data)

        feedback_path = (
            DataStorageService.TRAINING_DATA_DIR / f"feedback_{datetime.utcnow().date()}.json"
        )
        feedback_path.parent.mkdir(exist_ok=True)
        df.to_json(feedback_path, orient="records")

        return {
            "success": True,
            "feedback_count": len(feedback_data),
            "path": str(feedback_path),
            "verdict_distribution": df["verdict"].value_counts().to_dict()
            if not df.empty
            else {},
        }

    @staticmethod
    def get_model_training_readiness(db: Session) -> dict:
        """
        Check if we have enough validated data for retraining models.
        Returns recommendations for model updates.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        validated_reports = (
            db.query(Report)
            .filter(
                Report.created_at >= cutoff_date,
                Report.validation_status == "verified",
                Report.validation_score >= 0.7,
            )
            .count()
        )

        from models.community_validation import CommunityValidation

        community_votes = db.query(CommunityValidation).filter(
            CommunityValidation.created_at >= cutoff_date
        ).count()

        MIN_TRAINING_SAMPLES = 100
        MIN_FEEDBACK_SAMPLES = 50

        readiness = {
            "validated_reports": validated_reports,
            "community_votes": community_votes,
            "min_required_reports": MIN_TRAINING_SAMPLES,
            "min_required_votes": MIN_FEEDBACK_SAMPLES,
            "ready_for_training": (
                validated_reports >= MIN_TRAINING_SAMPLES
                and community_votes >= MIN_FEEDBACK_SAMPLES
            ),
            "recommendations": [],
        }

        if validated_reports < MIN_TRAINING_SAMPLES:
            readiness["recommendations"].append(
                f"Need {MIN_TRAINING_SAMPLES - validated_reports} more validated reports"
            )

        if community_votes < MIN_FEEDBACK_SAMPLES:
            readiness["recommendations"].append(
                f"Need {MIN_FEEDBACK_SAMPLES - community_votes} more community validations"
            )

        if readiness["ready_for_training"]:
            readiness["recommendations"].append("Ready to train new models!")

        return readiness

    @staticmethod
    def cleanup_old_data(db: Session, days_to_keep: int = 365) -> int:
        """
        Archive or delete old data beyond retention period.
        Keeps storage efficient while maintaining long-term statistics.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

        # We keep old reports but could archive them
        # deleted = db.query(Report).filter(Report.created_at < cutoff_date).delete()
        # db.commit()

        return 0  # Currently keeping all historical data
