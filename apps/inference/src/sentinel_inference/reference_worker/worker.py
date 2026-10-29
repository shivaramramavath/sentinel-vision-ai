"""
Sentinel AI Reference Worker.
Consumes `references.uploaded`, executes the 6-step biometric analysis pipeline,
indexes individual gallery vectors in Pinecone, and publishes `references.processed`.
"""
import asyncio
import json
import logging
import uuid
import os
import time
from typing import Dict, Any, Optional, List
import numpy as np

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from sentinel_inference.config import settings
from .config import QualityGatesConfig, DEFAULT_QUALITY_GATES
from .normalizer import normalize_image
from .face_analyzer import FaceAnalyzer, FaceAnalysisResult
from .body_analyzer import BodyAnalyzer, BodyAnalysisResult
from .set_checker import ReferenceSetChecker, SetCheckResult
from .vector_storage import ReferenceVectorStorage

logger = logging.getLogger("sentinel.reference_worker")

TOPIC_REFERENCES_UPLOADED = "references.uploaded"
TOPIC_REFERENCES_PROCESSED = "references.processed"
TOPIC_REFERENCES_DLQ = "references.uploaded.dlq"


class ReferenceWorker:
    def __init__(
        self,
        brokers: Optional[str] = None,
        config: QualityGatesConfig = DEFAULT_QUALITY_GATES,
        vector_storage: Optional[ReferenceVectorStorage] = None,
    ) -> None:
        self.brokers = brokers or settings.kafka_brokers
        self.config = config
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.producer: Optional[AIOKafkaProducer] = None
        self.running = False

        # Pipeline modules
        self.face_analyzer = FaceAnalyzer(config=self.config)
        self.body_analyzer = BodyAnalyzer(config=self.config)
        self.set_checker = ReferenceSetChecker(config=self.config)
        self.vector_storage = vector_storage or ReferenceVectorStorage()

        # In-memory case gallery cache for set-level checks
        self.case_gallery_cache: Dict[str, List[Dict[str, Any]]] = {}

    async def start(self) -> None:
        """Starts Kafka consumer and producer for the reference worker."""
        logger.info("Starting Reference Worker on Kafka brokers %s...", self.brokers)
        try:
            self.consumer = AIOKafkaConsumer(
                TOPIC_REFERENCES_UPLOADED,
                bootstrap_servers=self.brokers,
                group_id="sentinel-reference-workers",
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            self.producer = AIOKafkaProducer(bootstrap_servers=self.brokers)
            await self.consumer.start()
            await self.producer.start()
            self.running = True
            logger.info("✅ Reference Worker successfully subscribed to %s", TOPIC_REFERENCES_UPLOADED)

            asyncio.create_task(self._consume_loop())
        except Exception as e:
            logger.warn("Kafka unavailable for Reference Worker (%s). Running in standalone / direct mode.", e)
            self.running = False

    async def stop(self) -> None:
        """Stops Kafka connections cleanly."""
        self.running = False
        if self.consumer:
            await self.consumer.stop()
        if self.producer:
            await self.producer.stop()
        logger.info("Reference Worker stopped.")

    async def _consume_loop(self) -> None:
        while self.running and self.consumer:
            try:
                async for msg in self.consumer:
                    try:
                        payload = json.loads(msg.value.decode("utf-8"))
                        event_data = payload.get("data", payload)
                        await self.process_reference(event_data)
                    except Exception as err:
                        logger.error("Error processing reference message: %s", err)
            except Exception as e:
                if self.running:
                    logger.error("Consumer loop encountered error: %s", e)
                    await asyncio.sleep(2)

    def process_image_pipeline(
        self,
        image_input: bytes | str | np.ndarray,
        reference_id: str,
        case_id: str,
        person_id: str = "",
        expected_type: str = "face_front",
        photo_taken_at: Optional[str] = None,
        selected_face_box: Optional[Dict[str, int]] = None,
        selected_person_box: Optional[Dict[str, int]] = None,
        set_version: int = 1,
    ) -> Dict[str, Any]:
        """
        Synchronous / core 6-step image processing pipeline.
        Can be invoked directly by tests, benchmarks, or HTTP routes.
        """
        start_time = time.time()
        warnings: List[str] = []
        reject_reasons: List[str] = []

        # 1. Normalize image
        try:
            bgr_image, normalized_uri = normalize_image(image_input)
        except Exception as e:
            return {
                "referenceId": reference_id,
                "caseId": case_id,
                "personId": person_id,
                "status": "failed",
                "normalizedUri": "",
                "analysis": {},
                "embeddings": {},
                "warnings": [],
                "rejectReasons": [f"Image decoding or normalization failed: {str(e)}"],
                "setVersion": set_version,
                "latencySec": round(time.time() - start_time, 3),
            }

        is_face_type = expected_type.startswith("face_")
        is_body_type = expected_type.startswith("full_body_") or expected_type in ["last_seen_clothing", "other"]

        # 2. Person & Face Analysis
        face_res = self.face_analyzer.analyze_face(
            bgr_image,
            selected_box=selected_face_box,
            expected_type=expected_type,
        )
        body_res = self.body_analyzer.analyze_body(bgr_image, expected_type=expected_type, selected_box=selected_person_box)

        warnings.extend(face_res.warnings)
        warnings.extend(body_res.warnings)
        reject_reasons.extend(face_res.reject_reasons)
        reject_reasons.extend(body_res.reject_reasons)

        # Disambiguation Check: Multiple faces/persons found without explicit selection
        if face_res.face_count > 1 and not selected_face_box:
            return {
                "referenceId": reference_id,
                "caseId": case_id,
                "personId": person_id,
                "status": "needs_review",
                "normalizedUri": normalized_uri,
                "subject": {
                    "selectedFaceBox": None,
                    "faceCountDetected": face_res.face_count,
                    "candidateBoxes": face_res.candidate_boxes,
                },
                "analysis": {
                    "status": "needs_review",
                    "face": {"detected": True, "usable": False, "quality": 0.5},
                    "body": {"detected": body_res.detected, "usable": False},
                },
                "embeddings": {},
                "warnings": warnings + ["Multiple faces detected. Please select the missing person."],
                "rejectReasons": [],
                "setVersion": set_version,
                "latencySec": round(time.time() - start_time, 3),
            }

        # Determine overall status
        status = "ready"
        if reject_reasons:
            status = "rejected"
        elif not face_res.usable and not body_res.usable:
            status = "rejected"
            reject_reasons.append("Neither a usable facial crop nor full-body crop could be validated.")

        # 3. Set-Level Consistency Checks
        cached_set = self.case_gallery_cache.setdefault(case_id, [])
        current_record = {
            "referenceId": reference_id,
            "embedding": face_res.embedding,
            "poseBin": face_res.pose_bin,
            "photoTakenAt": photo_taken_at,
            "quality": face_res.quality,
            "type": expected_type,
            "setVersion": set_version,
        }

        eval_set = cached_set + [current_record]
        set_check: SetCheckResult = self.set_checker.evaluate_set(eval_set)

        warnings.extend(set_check.warnings)

        # If flagged as outlier in the set -> status = needs_review
        if reference_id in set_check.outlier_reference_ids:
            status = "needs_review"
            warnings.append("This photo exhibits low biometric similarity to the rest of the set and may show a different person.")

        # 4. Pinecone Embedding Storage
        embeddings_meta: Dict[str, Any] = {}
        if status == "ready":
            embeddings_meta = self.vector_storage.index_reference_embeddings(
                case_id=case_id,
                reference_id=reference_id,
                face_embedding=face_res.embedding,
                reid_embedding=body_res.embedding,
                pose_bin=face_res.pose_bin,
                quality=face_res.quality,
                photo_taken_at=photo_taken_at,
                reference_type=expected_type,
                set_version=set_version,
                face_model_version=self.config.arcface_model_version,
                reid_model_version=self.config.osnet_model_version,
            )
            # Add to local cache if valid
            cached_set.append(current_record)

        latency_sec = round(time.time() - start_time, 3)

        return {
            "referenceId": reference_id,
            "caseId": case_id,
            "personId": person_id,
            "status": status,
            "normalizedUri": normalized_uri,
            "analysis": {
                "status": status,
                "face": {
                    "detected": face_res.detected,
                    "quality": face_res.quality,
                    "blur": face_res.blur,
                    "laplacianVariance": face_res.laplacian_variance,
                    "sizePx": face_res.size_px,
                    "yawPitchRoll": list(face_res.yaw_pitch_roll),
                    "occlusion": face_res.occlusion,
                    "illumination": face_res.illumination,
                    "usable": face_res.usable,
                },
                "body": {
                    "detected": body_res.detected,
                    "completeness": body_res.completeness,
                    "bodyType": body_res.body_type,
                    "resolution": body_res.resolution,
                    "usable": body_res.usable,
                    "clothingHints": body_res.clothing_hints.__dict__ if body_res.clothing_hints else None,
                },
                "poseBin": face_res.pose_bin,
                "setCheck": {
                    "poseCoverage": set_check.pose_coverage,
                    "missingPoses": set_check.missing_poses,
                    "ageSpanYears": set_check.age_span_years,
                    "recommendations": set_check.recommendations,
                },
                "rejectReasons": reject_reasons,
                "warnings": warnings,
            },
            "embeddings": embeddings_meta,
            "warnings": warnings,
            "rejectReasons": reject_reasons,
            "setVersion": set_version,
            "latencySec": latency_sec,
        }

    async def process_reference(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Asynchronously processes uploaded reference and publishes `references.processed`."""
        reference_id = event_data.get("referenceId", f"ref_{uuid.uuid4().hex[:8]}")
        case_id = event_data.get("caseId", "unknown_case")
        person_id = event_data.get("personId", "")
        expected_type = event_data.get("type", "face_front")
        uri = event_data.get("uri", "")
        photo_taken_at = event_data.get("photoTakenAt")
        selected_face_box = event_data.get("selectedFaceBox")
        set_version = event_data.get("setVersion", 1)

        logger.info("Processing reference %s for case %s (type=%s)", reference_id, case_id, expected_type)

        processed = self.process_image_pipeline(
            image_input=uri,
            reference_id=reference_id,
            case_id=case_id,
            person_id=person_id,
            expected_type=expected_type,
            photo_taken_at=photo_taken_at,
            selected_face_box=selected_face_box,
            set_version=set_version,
        )

        # Publish output event `references.processed`
        if self.producer and self.running:
            try:
                event_envelope = {
                    "eventId": f"evt_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}",
                    "type": "references.processed",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "caseId": case_id,
                    "data": processed,
                }
                await self.producer.send_and_wait(
                    TOPIC_REFERENCES_PROCESSED,
                    json.dumps(event_envelope).encode("utf-8"),
                    key=case_id.encode("utf-8"),
                )
                logger.info("Published references.processed for %s (status=%s, latency=%.2fs)", reference_id, processed["status"], processed["latencySec"])
            except Exception as e:
                logger.error("Failed to publish references.processed to Kafka: %s", e)

        return processed
