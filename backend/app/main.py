import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from config import settings
from database import Base, SessionLocal, engine
from jobs.scheduler import run_scheduled_refresh
from routers import alerts, health, reports, risk, routes, safe_zones, sync, sos, community, flood_alerts, admin
from seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

# Composite indexes for models whose rows grow over time and are filtered by
# location/time on every request. Base.metadata.create_all() only creates
# indexes for tables it creates from scratch, so already-deployed databases
# need this idempotent backfill too.
_INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_escood_reports_lat_lng ON escood_reports (lat, lng)",
    "CREATE INDEX IF NOT EXISTS ix_escood_reports_created_at ON escood_reports (created_at)",
    "CREATE INDEX IF NOT EXISTS ix_escood_alerts_lat_lng ON escood_alerts (lat, lng)",
    "CREATE INDEX IF NOT EXISTS ix_escood_alerts_created_at ON escood_alerts (created_at)",
    "CREATE INDEX IF NOT EXISTS ix_escood_sos_lat_lng ON escood_sos (lat, lng)",
    "CREATE INDEX IF NOT EXISTS ix_escood_sos_status ON escood_sos (status)",
    "CREATE INDEX IF NOT EXISTS ix_escood_sos_user_status_created ON escood_sos (user_id, status, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_escood_flood_notifications_lat_lng ON escood_flood_notifications (lat, lng)",
    "CREATE INDEX IF NOT EXISTS ix_escood_flood_notifications_expires_at ON escood_flood_notifications (expires_at)",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            for stmt in _INDEX_STATEMENTS:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as exc:
                    logger.warning("Skipping index statement (%s): %s", stmt, exc)
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
        logger.info("Database initialized and seeded")
    except Exception as exc:
        logger.warning("Database unavailable at startup — API will retry on requests: %s", exc)

    scheduler.add_job(
        lambda: asyncio.run(run_scheduled_refresh()),
        "interval",
        minutes=settings.data_refresh_minutes,
        id="data_refresh",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("ESCOOD backend started — scheduler every %s min", settings.data_refresh_minutes)

    asyncio.create_task(run_scheduled_refresh())

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="ESCOOD API",
    description="AI-driven flood prediction, community validation, and evacuation guidance",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(risk.router, prefix=settings.api_prefix)
app.include_router(alerts.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
app.include_router(safe_zones.router, prefix=settings.api_prefix)
app.include_router(routes.router, prefix=settings.api_prefix)
app.include_router(sync.router, prefix=settings.api_prefix)
app.include_router(sos.router, prefix=settings.api_prefix)
app.include_router(community.router, prefix=settings.api_prefix)
app.include_router(flood_alerts.router, prefix=settings.api_prefix)
app.include_router(admin.router)

try:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
except RuntimeError:
    pass
