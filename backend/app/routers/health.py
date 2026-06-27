"""Health check route."""

from datetime import UTC, datetime

from fastapi import APIRouter

from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="healthy", timestamp=datetime.now(UTC))
