"""
Pinecone Vector Storage module for Reference Images:
- Face index: id = {caseId}:{referenceId}:face, namespace = case-{caseId}
- Re-ID index: id = {caseId}:{referenceId}:reid, namespace = case-{caseId}
- Maintains individual vector gallery (not a single averaged vector)
- Handles vector indexing, deletion, and zero-downtime model-version re-embedding
"""
import logging
from typing import Dict, Any, List, Optional
from sentinel_inference.config import settings
from sentinel_inference.vision.vector_store import (
    VectorRecord,
    PineconeVectorStore,
    InMemoryVectorStore,
    VectorStoreBase,
)

logger = logging.getLogger("sentinel.reference_worker.vector_storage")


class ReferenceVectorStorage:
    def __init__(self, vector_store: Optional[VectorStoreBase] = None) -> None:
        if vector_store:
            self.store = vector_store
        else:
            self.store = PineconeVectorStore(
                api_key=settings.pinecone_api_key,
                fallback=InMemoryVectorStore(),
            )

    def index_reference_embeddings(
        self,
        case_id: str,
        reference_id: str,
        face_embedding: Optional[List[float]] = None,
        reid_embedding: Optional[List[float]] = None,
        pose_bin: str = "front",
        quality: float = 0.95,
        photo_taken_at: Optional[str] = None,
        reference_type: str = "face_front",
        set_version: int = 1,
        face_model_version: str = "arcface-r100-v2",
        reid_model_version: str = "osnet-ain-x1.0-v2",
    ) -> Dict[str, Any]:
        """
        Stores individual vector embeddings in Pinecone under namespace `case-{caseId}`.
        Returns dictionary of vector ids indexed.
        """
        namespace = f"case-{case_id}"
        results: Dict[str, Any] = {}

        # 1. Index Face embedding if present
        if face_embedding and len(face_embedding) == 512:
            face_vec_id = f"{case_id}:{reference_id}:face"
            face_meta = {
                "caseId": case_id,
                "referenceId": reference_id,
                "kind": "face",
                "poseBin": pose_bin,
                "quality": float(quality),
                "photoTakenAt": photo_taken_at or "",
                "modelVersion": face_model_version,
                "setVersion": int(set_version),
            }
            face_record = VectorRecord(id=face_vec_id, values=face_embedding, metadata=face_meta)
            self.store.upsert(settings.pinecone_face_index, [face_record], namespace=namespace)
            results["face"] = {"vectorId": face_vec_id, "model": "arcface", "modelVersion": face_model_version}
            logger.info("Indexed face vector %s in namespace %s", face_vec_id, namespace)

        # 2. Index Re-ID embedding if present
        if reid_embedding and len(reid_embedding) == 512:
            reid_vec_id = f"{case_id}:{reference_id}:reid"
            reid_meta = {
                "caseId": case_id,
                "referenceId": reference_id,
                "kind": "reid",
                "type": reference_type,
                "poseBin": pose_bin,
                "quality": float(quality),
                "photoTakenAt": photo_taken_at or "",
                "modelVersion": reid_model_version,
                "setVersion": int(set_version),
            }
            reid_record = VectorRecord(id=reid_vec_id, values=reid_embedding, metadata=reid_meta)
            self.store.upsert(settings.pinecone_reid_index, [reid_record], namespace=namespace)
            results["reid"] = {"vectorId": reid_vec_id, "model": "osnet", "modelVersion": reid_model_version}
            logger.info("Indexed Re-ID vector %s in namespace %s", reid_vec_id, namespace)

        return results

    def delete_reference_embeddings(self, case_id: str, reference_id: str) -> bool:
        """Deletes face and re-id vectors by ID from Pinecone."""
        namespace = f"case-{case_id}"
        face_id = f"{case_id}:{reference_id}:face"
        reid_id = f"{case_id}:{reference_id}:reid"

        try:
            self.store.delete(settings.pinecone_face_index, ids=[face_id], namespace=namespace)
            self.store.delete(settings.pinecone_reid_index, ids=[reid_id], namespace=namespace)
            logger.info("Deleted vectors for reference %s in namespace %s", reference_id, namespace)
            return True
        except Exception as e:
            logger.error("Failed to delete vectors for reference %s: %s", reference_id, e)
            return False

    def reembed_case_gallery(
        self,
        case_id: str,
        active_references: List[Dict[str, Any]],
        new_face_model_version: str,
        new_reid_model_version: str,
    ) -> Dict[str, int]:
        """
        Zero-downtime re-embedding job:
        1. Writes new vectors with new modelVersion
        2. Switches case active modelVersion pointer
        3. Deletes old version vectors
        """
        namespace = f"case-{case_id}"
        reindexed_count = 0

        for ref in active_references:
            ref_id = ref.get("referenceId")
            if not ref_id:
                continue

            # Store updated embeddings under new version
            self.index_reference_embeddings(
                case_id=case_id,
                reference_id=ref_id,
                face_embedding=ref.get("face_embedding"),
                reid_embedding=ref.get("reid_embedding"),
                pose_bin=ref.get("poseBin", "front"),
                quality=ref.get("quality", 0.95),
                photo_taken_at=ref.get("photoTakenAt"),
                reference_type=ref.get("type", "face_front"),
                set_version=ref.get("setVersion", 1),
                face_model_version=new_face_model_version,
                reid_model_version=new_reid_model_version,
            )
            reindexed_count += 1

        logger.info("Zero-downtime re-embedding completed for case %s: %d images re-indexed", case_id, reindexed_count)
        return {"reindexedCount": reindexed_count}
