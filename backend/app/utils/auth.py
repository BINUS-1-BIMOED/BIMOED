import hmac

from fastapi import Header, HTTPException, status

from config import settings


async def require_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    """Gate for the /admin/* router. Fails closed: if ADMIN_API_KEY isn't set,
    every request is rejected rather than left open.
    """
    if not settings.admin_api_key or not x_admin_key or not hmac.compare_digest(x_admin_key, settings.admin_api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing X-Admin-Key header")
