"""FastAPI application entry point."""
import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sentinel_inference.config import settings
from sentinel_inference.routers import health
from sentinel_inference.routers import references
from sentinel_inference.reference_worker import ReferenceWorker

log = structlog.get_logger(__name__)
ref_worker = ReferenceWorker()

app = FastAPI(
    title="Sentinel Vision AI — Inference Service",
    description=(
        "Handles camera frame ingestion, person detection, "
        "face and Re-ID embedding extraction."
    ),
    version="0.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(references.router)


@app.on_event("startup")
async def on_startup() -> None:
    log.info(
        "sentinel_inference_started",
        host=settings.host,
        port=settings.port,
        environment=settings.environment,
    )
    # Start Reference Worker background loop
    try:
        await ref_worker.start()
    except Exception as e:
        log.warn("ref_worker_start_failed", error=str(e))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await ref_worker.stop()
    log.info("sentinel_inference_stopped")


if __name__ == "__main__":
    uvicorn.run(
        "sentinel_inference.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
        log_level=settings.log_level,
    )
