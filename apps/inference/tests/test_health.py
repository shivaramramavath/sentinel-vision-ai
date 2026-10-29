"""Tests for the health endpoint."""
import pytest
from httpx import AsyncClient, ASGITransport

from sentinel_inference.main import app


@pytest.mark.asyncio
async def test_health_returns_ok() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "sentinel-vision-inference"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_timestamp_is_iso8601() -> None:
    from datetime import datetime

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")

    data = response.json()
    # Should parse without error
    dt = datetime.fromisoformat(data["timestamp"])
    assert dt is not None
