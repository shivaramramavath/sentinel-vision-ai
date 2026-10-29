"""
Sentinel Vision AI — Segment Uploader & MinIO Archival Worker (Phase C3).

Transfers completed MP4 segments to MinIO/S3 under structured key:
  {siteId}/{cameraId}/{yyyy}/{mm}/{dd}/{HH}/{ts}.mp4
with local disk buffer resilience (never loses video during MinIO outages)
and indexes completed segments in MongoDB via NestJS control plane.
"""

import hashlib
import json
import logging
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
import httpx
from minio import Minio
from minio.error import S3Error

logger = logging.getLogger("sentinel.recorder.uploader")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3001/api/v1")


class ResilientSegmentUploader:
    def __init__(
        self,
        endpoint: str = "localhost:9000",
        access_key: str = "minioadmin",
        secret_key: str = "minioadmin",
        secure: bool = False,
        bucket_name: str = "camera-recordings",
        spool_dir: str = "data/spool_recordings",
    ) -> None:
        self.endpoint = endpoint
        self.bucket_name = bucket_name
        self.spool_dir = spool_dir
        Path(spool_dir).mkdir(parents=True, exist_ok=True)

        self.client: Optional[Minio] = None
        self.is_healthy = False
        self._init_minio(endpoint, access_key, secret_key, secure)

    def _init_minio(self, endpoint: str, access_key: str, secret_key: str, secure: bool) -> None:
        try:
            import urllib3
            http_client = urllib3.PoolManager(timeout=urllib3.Timeout(connect=0.5, read=1.0))
            self.client = Minio(
                endpoint=endpoint,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure,
                http_client=http_client,
            )
            self.is_healthy = self.client.bucket_exists(self.bucket_name)
            if not self.is_healthy:
                self.client.make_bucket(self.bucket_name)
                self.is_healthy = True
        except Exception as e:
            logger.debug(f"MinIO storage currently unavailable ({e}). Spool buffer active.")
            self.is_healthy = False

    def probe_health(self) -> bool:
        """Checks if MinIO is accessible, re-connecting if it was down."""
        if not self.client:
            return False
        try:
            exists = self.client.bucket_exists(self.bucket_name)
            self.is_healthy = exists
            return exists
        except Exception:
            self.is_healthy = False
            return False

    def build_object_key(
        self,
        site_id: str,
        camera_id: str,
        start_ts: float,
        filename: str,
    ) -> str:
        """
        Structured MinIO key pattern:
        {siteId}/{cameraId}/{yyyy}/{mm}/{dd}/{HH}/{ts}.mp4
        """
        dt = datetime.fromtimestamp(start_ts, tz=timezone.utc)
        return (
            f"{site_id}/{camera_id}/"
            f"{dt.strftime('%Y')}/{dt.strftime('%m')}/{dt.strftime('%d')}/{dt.strftime('%H')}/"
            f"{int(start_ts)}_{filename}"
        )

    def compute_sha256(self, file_path: str) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    async def upload_and_index_segment(
        self,
        site_id: str,
        camera_id: str,
        file_path: str,
        start_ts: float,
        duration_sec: float,
        motion_score: float = 0.0,
        has_gap: bool = False,
    ) -> Optional[dict]:
        """
        Uploads segment to MinIO and registers metadata in MongoDB.
        If MinIO is down, retains segment in spool directory for automated back-fill.
        """
        if not os.path.exists(file_path):
            return None

        file_size = os.path.getsize(file_path)
        if file_size < 1024:
            # Drop empty/truncated chunk
            return None

        filename = os.path.basename(file_path)
        checksum = self.compute_sha256(file_path)
        object_key = self.build_object_key(site_id, camera_id, start_ts, filename)

        end_ts = start_ts + duration_sec
        start_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc).isoformat()
        end_dt = datetime.fromtimestamp(end_ts, tz=timezone.utc).isoformat()

        is_minio_ok = self.probe_health()
        stored_uri = ""

        if is_minio_ok and self.client:
            try:
                self.client.fput_object(
                    bucket_name=self.bucket_name,
                    object_name=object_key,
                    file_path=file_path,
                    content_type="video/mp4",
                    metadata={
                        "x-amz-meta-camera-id": camera_id,
                        "x-amz-meta-site-id": site_id,
                        "x-amz-meta-checksum": checksum,
                        "x-amz-meta-uploaded-at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                stored_uri = f"s3://{self.bucket_name}/{object_key}"
                logger.info(f"[MinIO] Stored: {object_key} ({file_size / (1024*1024):.2f} MB, SHA-256: {checksum[:12]}...)")

                # Remove from spool once successfully written to MinIO
                try:
                    os.remove(file_path)
                except OSError:
                    pass

            except Exception as e:
                logger.warning(f"MinIO write error ({e}). Preserving segment in spool buffer.")
                stored_uri = f"file://{os.path.abspath(file_path)}"
        else:
            # MinIO outage: preserve in local disk spool buffer
            stored_uri = f"file://{os.path.abspath(file_path)}"
            logger.info(f"[Spool Buffer] Buffered segment on local disk: {filename} (MinIO unreachable)")

        # Index document in MongoDB via API
        index_payload = {
            "cameraId": camera_id,
            "siteId": site_id,
            "startTs": start_dt,
            "endTs": end_dt,
            "durationSec": duration_sec,
            "uri": stored_uri,
            "sizeBytes": file_size,
            "codec": "h264",
            "hasGap": has_gap,
            "motionScore": motion_score,
            "checksum": checksum,
            "tier": "hot",
        }

        try:
            async with httpx.AsyncClient(timeout=4.0) as http:
                resp = await http.post(
                    f"{API_BASE_URL}/cameras/{camera_id}/segments",
                    json=index_payload,
                )
                if resp.status_code in [200, 201]:
                    logger.debug(f"Indexed segment in MongoDB for '{camera_id}' ({duration_sec}s)")
        except Exception as api_err:
            logger.debug(f"API segment indexing notice: {api_err}")

        return index_payload

    async def backfill_spool_buffer(self) -> int:
        """
        Drains all buffered segments from the local spool directory to MinIO
        once connection health is restored (Definition of Done: unplug MinIO for 2 mins, back-fill cleanly).
        """
        if not self.probe_health() or not self.client:
            return 0

        spool_files = sorted(
            [
                os.path.join(root, f)
                for root, _, files in os.walk(self.spool_dir)
                for f in files
                if f.endswith(".mp4") and os.path.getsize(os.path.join(root, f)) >= 1024
            ]
        )

        if not spool_files:
            return 0

        logger.info(f"Back-filling {len(spool_files)} buffered segments from spool to MinIO...")
        backfilled_count = 0

        for file_path in spool_files:
            try:
                filename = os.path.basename(file_path)
                # Parse metadata from path structure or filename
                checksum = self.compute_sha256(file_path)
                parts = filename.split("_")
                cam_id = parts[0] if parts else "cam_001"
                now = time.time()
                object_key = self.build_object_key("site_primary", cam_id, now, filename)

                self.client.fput_object(
                    bucket_name=self.bucket_name,
                    object_name=object_key,
                    file_path=file_path,
                    content_type="video/mp4",
                    metadata={
                        "x-amz-meta-camera-id": cam_id,
                        "x-amz-meta-checksum": checksum,
                        "x-amz-meta-backfilled": "true",
                    },
                )
                os.remove(file_path)
                backfilled_count += 1
                logger.info(f"✓ Back-filled segment: {object_key}")
            except Exception as e:
                logger.error(f"Failed to backfill {file_path}: {e}")
                break

        return backfilled_count
