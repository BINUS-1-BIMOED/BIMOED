from sqlalchemy.orm import Session

from models.alert import Alert
from models.report import Report
from utils.geo import haversine_km


class ReportValidator:
    def validate(self, db: Session, report: Report) -> tuple[str, float, list[str]]:
        reasons: list[str] = []
        score = 0.0

        nearby_alerts = db.query(Alert).all()
        alert_match = False
        for alert in nearby_alerts:
            dist = haversine_km(report.lat, report.lng, alert.lat, alert.lng)
            if dist <= 5 and alert.severity in ("high", "critical"):
                alert_match = True
                reasons.append(f"Corroborated by official alert '{alert.title}' ({dist:.1f} km)")
                score += 0.4
                break

        nearby_reports = (
            db.query(Report)
            .filter(Report.id != report.id, Report.category == report.category)
            .all()
        )
        cluster_count = sum(1 for r in nearby_reports if haversine_km(report.lat, report.lng, r.lat, r.lng) <= 2)
        if cluster_count >= 1:
            reasons.append(f"{cluster_count} similar report(s) within 2 km")
            score += min(0.35, cluster_count * 0.15)

        severity_weight = {"low": 0.05, "moderate": 0.1, "high": 0.15, "critical": 0.2}
        score += severity_weight.get(report.severity, 0.1)

        if report.description and len(report.description.strip()) >= 20:
            reasons.append("Detailed description provided")
            score += 0.1

        if report.photo_url:
            reasons.append("Photo evidence attached")
            score += 0.15

        confidence = round(min(1.0, score), 2)
        if confidence >= 0.55 or alert_match:
            status = "verified"
        elif confidence >= 0.25:
            status = "pending"
        else:
            status = "flagged"
            reasons.append("Insufficient corroboration from alerts or nearby reports")

        return status, confidence, reasons
