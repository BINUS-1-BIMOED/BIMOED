import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import Base, SessionLocal, engine
from jobs.scheduler import run_scheduled_refresh
from routers import alerts, health, reports, risk, routes, safe_zones, sync
from seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
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

try:
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
except RuntimeError:
    pass
