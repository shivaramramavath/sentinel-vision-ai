"""
YOLO Person Detector module.

Detects persons (COCO class 0) with confidence threshold 0.4 and NMS IoU 0.5.
Supports batch inference and FP16 execution.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Sequence
import numpy as np
import torch


@dataclass
class PersonDetection:
    bbox: list[float]  # [x1, y1, x2, y2]
    confidence: float
    crop: np.ndarray   # Extracted image crop (BGR uint8)


class PersonDetectorBase(ABC):
    @abstractmethod
    def detect_batch(self, frames: Sequence[np.ndarray]) -> list[list[PersonDetection]]:
        pass


class YoloPersonDetector(PersonDetectorBase):
    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        conf: float = 0.4,
        iou: float = 0.5,
        device: str = "cpu",
        half: bool = False,
    ) -> None:
        self.conf = conf
        self.iou = iou
        self.device = device
        self.half = half and (device != "cpu" and torch.cuda.is_available())

        from ultralytics import YOLO
        self.model = YOLO(model_name)
        if self.device != "cpu":
            self.model.to(self.device)
        if self.half:
            self.model.model.half()

    def detect_batch(self, frames: Sequence[np.ndarray]) -> list[list[PersonDetection]]:
        if not frames:
            return []

        # Run batch prediction filtering strictly on COCO class 0 (person)
        results = self.model.predict(
            source=list(frames),
            conf=self.conf,
            iou=self.iou,
            classes=[0],
            device=self.device,
            half=self.half,
            verbose=False,
        )

        batch_detections: list[list[PersonDetection]] = []

        for frame, result in zip(frames, results):
            frame_detections: list[PersonDetection] = []
            h, w = frame.shape[:2]

            boxes = result.boxes
            if boxes is not None and len(boxes) > 0:
                xyxy = boxes.xyxy.cpu().numpy()
                confs = boxes.conf.cpu().numpy()

                for box, score in zip(xyxy, confs):
                    x1 = max(0, int(box[0]))
                    y1 = max(0, int(box[1]))
                    x2 = min(w, int(box[2]))
                    y2 = min(h, int(box[3]))

                    # Filter out degenerate boxes
                    if x2 - x1 >= 20 and y2 - y1 >= 40:
                        crop = frame[y1:y2, x1:x2].copy()
                        frame_detections.append(
                            PersonDetection(
                                bbox=[float(x1), float(y1), float(x2), float(y2)],
                                confidence=float(score),
                                crop=crop,
                            )
                        )

            batch_detections.append(frame_detections)

        return batch_detections
