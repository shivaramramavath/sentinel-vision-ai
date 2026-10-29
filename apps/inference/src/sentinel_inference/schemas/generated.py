"""
AUTO-GENERATED FILE — DO NOT EDIT DIRECTLY.
Generated from packages/generated-json-schema (Zod JSON-Schema single source of truth).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar
from pydantic import BaseModel, Field

T = TypeVar('T')

class AlertsCreatedPayload(BaseModel):
    pass

class Camera(BaseModel):
    pass

class CandidatesScoredPayload(BaseModel):
    pass

class Case(BaseModel):
    pass

class CreateCameraDto(BaseModel):
    pass

class CreateCaseDto(BaseModel):
    pass

class DeadLetterQueuePayload(BaseModel):
    pass

class DetectionsPersonPayload(BaseModel):
    pass

class EmbeddingsGeneratedPayload(BaseModel):
    pass

class EventEnvelope(BaseModel, Generic[T]):
    """Canonical event envelope for Sentinel Vision AI messages."""

    model_config = {'populate_by_name': True}

class JourneysUpdatedPayload(BaseModel):
    pass

class SearchJobsCommandPayload(BaseModel):
    pass

class SearchJobsProgressPayload(BaseModel):
    pass

class SightingsCreatedPayload(BaseModel):
    pass

class UpdateCameraDto(BaseModel):
    pass

class UpdateCaseDto(BaseModel):
    pass

class VideoFramesRawPayload(BaseModel):
    pass
