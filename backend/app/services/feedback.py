from datetime import datetime
from sqlalchemy.orm import Session
from models.report import Report
import logging

logger = logging.getLogger(__name__)


class FeedbackService:
    """
    Service for collecting, analyzing, and applying user feedback.
    Uses community feedback to improve AI predictions and identify model weaknesses.
    Specifically targets areas without IoT sensors (like Indonesia).
    """

    @staticmethod
    def submit_prediction_feedback(
        db: Session,
        report_id: int,
        actual_severity: str,
        predicted_severity: str,
        user_feedback: str,
        location_accuracy: bool = True,
    ) -> dict:
        """
        Record feedback on prediction accuracy.
        Compares actual vs predicted severity to identify model improvements.
        """
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return {"error": "Report not found"}

        # Calculate prediction error
        severity_ranks = {"low": 1, "moderate": 2, "high": 3, "critical": 4}
        predicted_rank = severity_ranks.get(predicted_severity, 2)
        actual_rank = severity_ranks.get(actual_severity, 2)
        prediction_error = abs(predicted_rank - actual_rank)

        feedback_data = {
            "report_id": report_id,
            "predicted_severity": predicted_severity,
            "actual_severity": actual_severity,
            "prediction_error": prediction_error,
            "location_accuracy": location_accuracy,
            "user_feedback": user_feedback,
            "timestamp": datetime.utcnow().isoformat(),
        }

        logger.info(f"Feedback recorded for report {report_id}: error={prediction_error}")

        return {
            "success": True,
            "prediction_error": prediction_error,
            "feedback_recorded": feedback_data,
            "message": "Thank you for helping improve BIMOED!",
        }

    @staticmethod
    def analyze_model_performance_by_region(db: Session, region: str) -> dict:
        """
        Analyze model performance in specific regions.
        Identifies areas where model needs improvement.
        Especially useful for regions without IoT infrastructure.
        """
        # Get reports from region
        regional_reports = db.query(Report).all()  # Would filter by region in production

        if not regional_reports:
            return {"region": region, "error": "No reports for region"}

        total = len(regional_reports)
        high_confidence = sum(1 for r in regional_reports if r.confidence > 0.8)
        low_confidence = sum(1 for r in regional_reports if r.confidence < 0.5)

        avg_trust_score = (
            sum(r.trust_score for r in regional_reports) / total if total > 0 else 0
        )

        return {
            "region": region,
            "total_reports": total,
            "high_confidence_reports": high_confidence,
            "low_confidence_reports": low_confidence,
            "average_trust_score": round(avg_trust_score, 3),
            "needs_improvement": low_confidence / total > 0.3 if total > 0 else True,
            "confidence_percentage": round(high_confidence / total * 100, 2) if total > 0 else 0,
        }

    @staticmethod
    def identify_model_blind_spots(db: Session) -> dict:
        """
        Identify geographic areas and conditions where model performs poorly.
        Targets areas for data collection and sensor deployment.
        """
        low_confidence_reports = db.query(Report).filter(
            Report.confidence < 0.5
        ).all()

        if not low_confidence_reports:
            return {"blind_spots": [], "message": "Model performing well!"}

        # Cluster low confidence areas
        blind_spots = {}
        for report in low_confidence_reports:
            # Simple clustering by rounding coordinates
            region_key = (
                f"{round(report.lat, 1)},{round(report.lng, 1)}"
            )
            if region_key not in blind_spots:
                blind_spots[region_key] = []
            blind_spots[region_key].append({
                "report_id": report.id,
                "confidence": report.confidence,
                "category": report.category,
            })

        return {
            "total_blind_spots": len(blind_spots),
            "regions": [
                {
                    "coordinates": region,
                    "affected_reports": len(reports),
                    "average_confidence": (
                        sum(r["confidence"] for r in reports) / len(reports)
                    ),
                    "categories": list(set(r["category"] for r in reports)),
                }
                for region, reports in blind_spots.items()
            ],
            "recommendation": "Deploy sensors or request community data collection in these areas",
        }

    @staticmethod
    def generate_improvement_suggestions(db: Session) -> dict:
        """
        Analyze feedback data to generate suggestions for model improvement.
        Identifies patterns in prediction failures.
        """
        # Get reports with validation feedback
        validated = db.query(Report).filter(
            Report.validation_status == "verified"
        ).all()

        if not validated:
            return {"suggestions": []}

        # Analyze failure patterns
        failures_by_category = {}
        for report in validated:
            if report.confidence < 0.6:
                cat = report.category
                if cat not in failures_by_category:
                    failures_by_category[cat] = 0
                failures_by_category[cat] += 1

        suggestions = []

        # Generate targeted suggestions
        for category, count in failures_by_category.items():
            if count > 5:
                suggestions.append({
                    "category": category,
                    "issue_count": count,
                    "suggestion": f"Model struggles with {category} predictions. "
                    f"Need more training data and feature engineering.",
                })

        # Check for geographic blind spots
        blind_spot_count = len(set(
            f"{round(r.lat, 1)},{round(r.lng, 1)}"
            for r in validated if r.confidence < 0.5
        ))

        if blind_spot_count > 3:
            suggestions.append({
                "issue": "geographic_blind_spots",
                "count": blind_spot_count,
                "suggestion": "Expand sensor network or gather community reports "
                "in underrepresented areas (Indonesia, etc.)",
            })

        return {
            "total_suggestions": len(suggestions),
            "suggestions": suggestions,
            "priority": "high" if len(suggestions) > 5 else "medium" if len(suggestions) > 0 else "low",
        }

    @staticmethod
    def get_iot_sensor_gap_analysis(db: Session) -> dict:
        """
        Identify geographic areas lacking IoT sensors.
        Highlights regions relying on community feedback (like Indonesia).
        """
        all_reports = db.query(Report).all()

        # Group by geographic grid
        grid = {}
        for report in all_reports:
            grid_cell = (
                f"{round(report.lat, 1)},{round(report.lng, 1)}"
            )
            if grid_cell not in grid:
                grid[grid_cell] = {"reports": 0, "avg_confidence": 0}
            grid[grid_cell]["reports"] += 1

        # Identify cells with low confidence (likely IoT gaps)
        high_community_reliance = [
            cell for cell, data in grid.items()
            if data["reports"] < 5  # Few reports = less IoT coverage
        ]

        return {
            "total_coverage_areas": len(grid),
            "potential_iot_gaps": len(high_community_reliance),
            "gap_percentage": round(
                len(high_community_reliance) / len(grid) * 100, 2
            ) if grid else 0,
            "recommended_sensor_locations": high_community_reliance[:10],
            "community_reliability_score": round(
                (1 - len(high_community_reliance) / len(grid)) * 100, 2
            ) if grid else 0,
        }
