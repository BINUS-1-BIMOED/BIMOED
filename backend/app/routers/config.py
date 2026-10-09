from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/maps-key")
def get_maps_key():
    """Google Maps JS API key for the frontend's 3D globe view.

    The key is meant for client-side use (restricted by HTTP referrer in the
    Google Cloud console, not by keeping it secret) — this endpoint just lets
    it live in the backend's .env instead of the frontend build.
    """
    return {"key": settings.google_maps_api_key}
