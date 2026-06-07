import logging

from config import settings
from database import SessionLocal
from services.data_collector import DataCollector

logger = logging.getLogger(__name__)


async def run_scheduled_refresh() -> None:
    collector = DataCollector()
    db = SessionLocal()
    try:
        await collector.refresh_location(db, settings.default_lat, settings.default_lng)
        grid_points = [
            (settings.default_lat + 0.02, settings.default_lng),
            (settings.default_lat - 0.02, settings.default_lng + 0.02),
            (settings.default_lat, settings.default_lng - 0.02),
        ]
        for lat, lng in grid_points:
            await collector.refresh_location(db, lat, lng)
        logger.info("Scheduled data refresh completed")
    except Exception as exc:
        logger.exception("Scheduled refresh failed: %s", exc)
    finally:
        db.close()
