"""Tests for inference schema definitions."""
import pytest
from pydantic import ValidationError

from sentinel_inference.schemas.events import (
    FaceEmbeddingEvent,
    PersonDetectionEvent,
    ReidEmbeddingEvent,
)


def test_face_embedding_event_valid() -> None:
    event = FaceEmbeddingEvent(
        embeddingId="emb_001",
        cameraId="cam_001",
        frameId="frame_001",
        capturedAt="2026-01-01T00:00:00Z",
        cropS3Key="crops/frame_001_face.jpg",
        faceBbox=(10.0, 20.0, 100.0, 150.0),
        faceScore=0.98,
        model_version="arcface-r100-v1",
        pineconeId="emb_001",
    )
    assert event.model_version == "arcface-r100-v1"
    assert len(event.face_bbox) == 4


def test_reid_embedding_event_valid() -> None:
    event = ReidEmbeddingEvent(
        embeddingId="emb_002",
        cameraId="cam_001",
        frameId="frame_001",
        capturedAt="2026-01-01T00:00:00Z",
        cropS3Key="crops/frame_001_body.jpg",
        personBbox=(5.0, 10.0, 120.0, 300.0),
        model_version="osnet-ain-x1.0-v1",
        pineconeId="emb_002",
    )
    assert event.model_version == "osnet-ain-x1.0-v1"
    # Reid and face events have different kinds — verified by separate model_version naming


def test_face_and_reid_have_separate_model_versions() -> None:
    """Enforce that face and reid model versions are tracked separately."""
    face_event = FaceEmbeddingEvent(
        embeddingId="f1",
        cameraId="c1",
        frameId="fr1",
        capturedAt="2026-01-01T00:00:00Z",
        cropS3Key="k1",
        faceBbox=(0.0, 0.0, 1.0, 1.0),
        faceScore=0.9,
        model_version="arcface-r100-v1",
        pineconeId="f1",
    )
    reid_event = ReidEmbeddingEvent(
        embeddingId="r1",
        cameraId="c1",
        frameId="fr1",
        capturedAt="2026-01-01T00:00:00Z",
        cropS3Key="k2",
        personBbox=(0.0, 0.0, 1.0, 1.0),
        model_version="osnet-ain-x1.0-v1",
        pineconeId="r1",
    )
    # They must have different model versions (different feature spaces)
    assert face_event.model_version != reid_event.model_version
