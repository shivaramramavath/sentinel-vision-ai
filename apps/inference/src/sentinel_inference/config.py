"""Application configuration via environment variables."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration is read from environment variables."""

    model_config = SettingsConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    environment: str = "development"

    # Kafka
    kafka_brokers: str = "localhost:9092"

    @property
    def kafka_broker_list(self) -> list[str]:
        return self.kafka_brokers.split(",")

    # MinIO / S3
    minio_endpoint: str = "localhost"
    minio_port: int = 9000
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_use_ssl: bool = False
    minio_bucket_photos: str = "reference-photos"
    minio_bucket_thumbnails: str = "sighting-thumbnails"
    minio_bucket_crops: str = "frame-crops"

    @property
    def minio_url(self) -> str:
        scheme = "https" if self.minio_use_ssl else "http"
        return f"{scheme}://{self.minio_endpoint}:{self.minio_port}"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_face_index: str = "face-embeddings"
    pinecone_reid_index: str = "reid-embeddings"

    # Model versions — stored with every embedding
    arcface_model_version: str = "arcface-r100-v1"
    osnet_model_version: str = "osnet-ain-x1.0-v1"
    yolo_model_version: str = "yolov8n-v1"
    scrfd_model_version: str = "scrfd-10g-v1"

    # Inference params
    yolo_confidence_threshold: float = 0.5
    face_detection_min_score: float = 0.7
    frame_rate_fps: int = 5


settings = Settings()
