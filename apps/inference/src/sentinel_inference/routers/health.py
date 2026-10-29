"""Health check endpoint."""
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from sentinel_inference.config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    timestamp: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Returns service health status."""
    return HealthResponse(
        status="ok",
        service="sentinel-vision-inference",
        version="0.0.0",
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
