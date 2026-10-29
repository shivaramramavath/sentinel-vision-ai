"""
Kafka event payload schemas for the inference service.

These mirror the TypeScript interfaces in packages/shared-types/src/kafka-events.ts.
Kept in sync manually — both sides enforce the same field names and types.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class FrameRawEvent(BaseModel):
    """Emitted when a raw frame is extracted from a camera stream."""

    frame_id: str = Field(alias="frameId")
    camera_id: str = Field(alias="cameraId")
    captured_at: datetime = Field(alias="capturedAt")
    frame_s3_key: str = Field(alias="frameS3Key")
    sequence_number: int = Field(alias="sequenceNumber")

    model_config = {"populate_by_name": True}


class PersonDetectionEvent(BaseModel):
    """Emitted when YOLO detects a person in a frame."""

    detection_id: str = Field(alias="detectionId")
    camera_id: str = Field(alias="cameraId")
    frame_id: str = Field(alias="frameId")
    captured_at: datetime = Field(alias="capturedAt")
    person_bbox: tuple[float, float, float, float] = Field(alias="personBbox")
    person_score: float = Field(alias="personScore")
    bytetrack_id: int | None = Field(default=None, alias="bytetrackId")
    crop_s3_key: str = Field(alias="cropS3Key")

    model_config = {"populate_by_name": True}


class FaceEmbeddingEvent(BaseModel):
    """
    Emitted after face embedding is computed.

    The vector itself is stored in Pinecone (face-embeddings index, 512-dim).
    This payload contains only metadata.
    """

    embedding_id: str = Field(alias="embeddingId")
    camera_id: str = Field(alias="cameraId")
    frame_id: str = Field(alias="frameId")
    captured_at: datetime = Field(alias="capturedAt")
    crop_s3_key: str = Field(alias="cropS3Key")
    face_bbox: tuple[float, float, float, float] = Field(alias="faceBbox")
    face_score: float = Field(alias="faceScore")
    model_version: str = Field(alias="model_version")
    pinecone_id: str = Field(alias="pineconeId")

    model_config = {"populate_by_name": True}


class ReidEmbeddingEvent(BaseModel):
    """
    Emitted after Re-ID embedding is computed.

    The vector is stored in Pinecone (reid-embeddings index, 256-dim).
    This is a SEPARATE index from face embeddings — never mixed.
    """

    embedding_id: str = Field(alias="embeddingId")
    camera_id: str = Field(alias="cameraId")
    frame_id: str = Field(alias="frameId")
    captured_at: datetime = Field(alias="capturedAt")
    crop_s3_key: str = Field(alias="cropS3Key")
    person_bbox: tuple[float, float, float, float] = Field(alias="personBbox")
    model_version: str = Field(alias="model_version")
    pinecone_id: str = Field(alias="pineconeId")
    bytetrack_id: int | None = Field(default=None, alias="bytetrackId")

    model_config = {"populate_by_name": True}
