from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.report import Report
from models.community_validation import CommunityValidation
from utils.geo import haversine_km


class TrustScoreService:
    """
    Calculate trust scores for reports based on:
    - User history accuracy
    - Geographical consistency
    - Report clustering (multiple reports from same area)
    - Temporal patterns (timing matches weather data)
    """

    @staticmethod
    def calculate_user_history_accuracy(db: Session, user_id: str | None) -> float:
        """
        Calculate accuracy of user's previous reports.
        Score: 0-1 based on how many of their reports were validated.
        """
        if not user_id:
            return 0.5  # Neutral for anonymous users

        user_reports = db.query(Report).filter(Report.user_id == user_id).all()
        if not user_reports:
            return 0.5  # Neutral for new users

        validated_correctly = sum(
            1 for r in user_reports 
            if r.validation_status == "verified" and r.validation_score > 0.7
        )
        return min(1.0, validated_correctly / max(len(user_reports), 1))

    @staticmethod
    def calculate_geographical_consistency(db: Session, lat: float, lng: float, category: str) -> float:
        """
        Check if location makes sense for the report category.
        Score: 0-1 based on proximity to historical flood zones.
        """
        # Get recent reports in nearby area (10km radius)
        recent_reports = db.query(Report).filter(
            Report.created_at >= datetime.utcnow() - timedelta(days=30)
        ).all()

        nearby_reports = [
            r for r in recent_reports
            if haversine_km(lat, lng, r.lat, r.lng) <= 10
        ]

        if not nearby_reports:
            return 0.5  # Neutral if no nearby reports

        # Higher score if many similar recent reports nearby
        similar_category = sum(1 for r in nearby_reports if r.category == category)
        return min(1.0, 0.5 + (similar_category / (len(nearby_reports) + 1)) * 0.5)

    @staticmethod
    def calculate_report_clustering(db: Session, lat: float, lng: float, radius_km: float = 1.0) -> float:
        """
        Check if there are multiple reports from same location (clustering).
        Score: 0-1, higher if multiple reports clustered together.
        """
        recent_reports = db.query(Report).filter(
            Report.created_at >= datetime.utcnow() - timedelta(hours=24),
            Report.validation_status != "flagged",
        ).all()

        clustered = [
            r for r in recent_reports
            if haversine_km(lat, lng, r.lat, r.lng) <= radius_km
        ]

        # More reports in cluster = higher confidence
        cluster_score = min(1.0, len(clustered) / 10)  # Max at 10 reports
        return 0.5 + (cluster_score * 0.5)  # 0.5-1.0 range

    @staticmethod
    def calculate_temporal_consistency(rainfall_mm: float, report_severity: str) -> float:
        """
        Check if report severity matches current weather conditions.
        Score: 0-1 based on correlation between rainfall and report severity.
        """
        severity_threshold = {
            "critical": 20,    # High rainfall expected for critical
            "high": 10,        # Medium rainfall for high
            "moderate": 5,     # Low rainfall for moderate
            "low": 0,          # Can occur anytime
        }

        threshold = severity_threshold.get(report_severity, 5)
        
        if rainfall_mm >= threshold:
            return min(1.0, 0.7 + (rainfall_mm / 30) * 0.3)  # 0.7-1.0
        else:
            return max(0.3, 1.0 - (threshold - rainfall_mm) / 20)  # 0.3-1.0

    @staticmethod
    def calculate_trust_score(
        db: Session,
        report: Report,
        user_id: str | None,
        rainfall_mm: float,
    ) -> float:
        """
        Calculate comprehensive trust score for a report.
        Combines all factors into single 0-1 score.
        """
        user_accuracy = TrustScoreService.calculate_user_history_accuracy(db, user_id)
        geographical = TrustScoreService.calculate_geographical_consistency(
            db, report.lat, report.lng, report.category
        )
        clustering = TrustScoreService.calculate_report_clustering(db, report.lat, report.lng)
        temporal = TrustScoreService.calculate_temporal_consistency(rainfall_mm, report.severity)

        # Weighted average (user history is most important)
        weights = {
            "user_accuracy": 0.35,
            "geographical": 0.25,
            "clustering": 0.25,
            "temporal": 0.15,
        }

        trust_score = (
            user_accuracy * weights["user_accuracy"]
            + geographical * weights["geographical"]
            + clustering * weights["clustering"]
            + temporal * weights["temporal"]
        )

        return min(1.0, max(0.0, trust_score))

    @staticmethod
    def get_community_validation_score(db: Session, report_id: int) -> float:
        """
        Calculate community validation score from user votes.
        Returns 0-1 where 1 = all users validated as accurate.
        """
        validations = db.query(CommunityValidation).filter(
            CommunityValidation.report_id == report_id
        ).all()

        if not validations:
            return 0.5  # Neutral if no validations yet

        accurate_votes = sum(
            1 for v in validations
            if v.verdict == "accurate"
        )
        
        inaccurate_votes = sum(
            1 for v in validations
            if v.verdict == "inaccurate"
        )

        if accurate_votes + inaccurate_votes == 0:
            return 0.5

        # Score based on accurate vs inaccurate votes
        score = accurate_votes / (accurate_votes + inaccurate_votes)
        
        # Factor in number of votes (more votes = more confident)
        confidence_boost = min(0.2, len(validations) / 20)
        
        return min(1.0, score * 0.8 + 0.5 + confidence_boost * 0.2)

    @staticmethod
    def detect_duplicate_reports(db: Session, lat: float, lng: float, category: str, hours: int = 2) -> int | None:
        """
        Check if there's already a recent report for same location/category.
        Returns ID of potential duplicate or None.
        """
        recent = db.query(Report).filter(
            Report.created_at >= datetime.utcnow() - timedelta(hours=hours),
            Report.category == category,
        ).all()

        for report in recent:
            if haversine_km(lat, lng, report.lat, report.lng) < 0.5:  # Within 500m
                return report.id

        return None
