from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def home():
    return {"message": "ESCOOD API Running", "version": "1.0.0"}


@router.get("/health")
def health():
    return {"status": "ok"}
