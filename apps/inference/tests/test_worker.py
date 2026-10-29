"""Tests for the simulated AI inference worker."""
import pytest
from unittest.mock import AsyncMock, patch
from sentinel_inference.worker import SimulatedInferenceWorker, TOPIC_SEARCH_PROGRESS, TOPIC_CANDIDATES_SCORED


@pytest.mark.asyncio
async def test_worker_process_shard_emits_progress_and_candidate():
    worker = SimulatedInferenceWorker(brokers="localhost:9092")
    worker.producer = AsyncMock()

    shard_payload = {
        "jobId": "job_test_101",
        "caseId": "case_test_202",
        "shardId": "shard_001",
        "cameraId": "cam_003",
        "windowStart": "2026-10-28T10:00:00Z",
        "windowEnd": "2026-10-28T10:05:00Z",
        "minConfidence": 0.7,
        "referencePhotoUrl": "https://example.com/photo.jpg",
    }

    await worker._process_shard(shard_payload, "cam_003", "corr_123")

    # Verify progress, candidate, sighting, and journey events sent
    assert worker.producer.send_and_wait.call_count == 4

    # Check candidates.scored call
    candidate_call = worker.producer.send_and_wait.call_args_list[0]
    topic = candidate_call[0][0]
    assert topic == TOPIC_CANDIDATES_SCORED

    import json
    candidate_envelope = json.loads(candidate_call[1]["value"].decode("utf-8"))
    payload = candidate_envelope["payload"]

    # Verify Invariants:
    # 1. Metric space separation
    assert "faceScore" in payload
    assert "reidScore" in payload
    assert payload["faceScore"] != payload["reidScore"]

    # 2. Model version stored
    assert payload["model_version"] == "v1.0"

    # 3. Compliance phrasing: Possible match
    assert payload["displayLabel"] == "Possible match"

    # Check sightings.created call
    sighting_call = worker.producer.send_and_wait.call_args_list[1]
    assert sighting_call[0][0] == "sightings.created"
    sighting_env = json.loads(sighting_call[1]["value"].decode("utf-8"))
    assert sighting_env["payload"]["displayLabel"] == "Possible match"

    # Check journeys.updated call
    journey_call = worker.producer.send_and_wait.call_args_list[2]
    assert journey_call[0][0] == "journeys.updated"
    journey_env = json.loads(journey_call[1]["value"].decode("utf-8"))
    assert "cameraSequence" in journey_env["payload"]

    # Check search.jobs.progress call
    progress_call = worker.producer.send_and_wait.call_args_list[3]
    assert progress_call[0][0] == TOPIC_SEARCH_PROGRESS
    progress_envelope = json.loads(progress_call[1]["value"].decode("utf-8"))
    assert progress_envelope["payload"]["completedDelta"] == 1
    assert progress_envelope["payload"]["candidatesFoundDelta"] == 1
