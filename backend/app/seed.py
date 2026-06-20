from sqlalchemy.orm import Session

from models.safe_zone import SafeZone


def seed_database(db: Session) -> None:
    """
    Initialize database with essential data only (no dummy data).
    Real data is populated through API endpoints and external data sources.
    """
    # Create essential safe zones if none exist
    # These should be actual emergency shelters and safe locations
    if db.query(SafeZone).count() == 0:
        # Leave empty - users should add real safe zones through admin API
        # Real safe zones should come from government/emergency services
        pass

    db.commit()
