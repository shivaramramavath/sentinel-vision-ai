# Missing-Persons, Cases, References, and Reference-Sets Architecture

This document defines the statutory, operational, and forensic rules governing missing-person dossiers, reference images, and enrolled reference sets in the **Sentinel Vision AI** platform.

---

## 1. Data Models & Schemas

### MissingPerson (`missing_persons` collection)
```json
{
  "personId": "mp_c22407e6",
  "caseId": "case_chen01",
  "status": "draft | active | under_verification | found | closed | suspended",
  "identity": {
    "fullName": "Maya Chen",
    "aliases": ["May"],
    "gender": "female",
    "dob": "2012-05-14",
    "approxAgeRange": { "min": 14, "max": 15 },
    "nationality": "US",
    "languages": ["English", "Mandarin"]
  },
  "physical": {
    "heightCm": 155,
    "build": "slender",
    "hair": "black, shoulder length",
    "eyes": "brown",
    "skinTone": "fair",
    "distinguishingMarks": ["scar above left eyebrow"],
    "glasses": false,
    "beard": false
  },
  "vulnerability": {
    "isMinor": true,
    "medicalNotesEncrypted": "iv:authTag:cipher",
    "mentalHealthFlag": false,
    "requiresUrgentPriority": true
  },
  "lastSeen": {
    "ts": "2026-10-28T09:15:00Z",
    "locationText": "Terminal 2 Concourse, Central Station",
    "coordinates": { "type": "Point", "coordinates": [78.4867, 17.385] },
    "cameraId": "cam_central_01",
    "direction": "East towards Platform 4",
    "circumstances": "Alighted from southbound train"
  },
  "lastSeenHistory": [
    { "ts": "...", "locationText": "...", "coordinates": { "type": "Point", "coordinates": [...] }, "recordedAt": "...", "recordedBy": "...", "source": "..." }
  ],
  "lastSeenClothing": {
    "items": [{ "type": "hoodie", "colour": "yellow", "brand": "Adidas" }],
    "accessories": [{ "type": "backpack", "colour": "teal" }],
    "footwear": "white sneakers",
    "carriedItems": ["blue water bottle"]
  },
  "reporter": {
    "name": "David Chen",
    "relation": "Father",
    "phoneEncrypted": "iv:authTag:cipher",
    "emailEncrypted": "iv:authTag:cipher",
    "contactPreference": "phone"
  },
  "authority": {
    "reportNumber": "FIR-2026-99214",
    "station": "Metro Central Precinct",
    "officerName": "Det. Sarah Vance",
    "authorizedBy": "Duty Magistrate",
    "authorizedAt": "2026-10-28T09:30:00Z",
    "legalBasisNote": "Statutory Duty under Missing Persons Protection Act"
  },
  "priority": "critical",
  "computedPriorityScore": 85,
  "searchPolicy": {
    "defaultMinConfidence": 0.75,
    "defaultTimeWindowHours": 24,
    "autoSearchOnUpdate": true
  },
  "referenceSetVersion": 1,
  "version": 1,
  "history": [
    { "at": "...", "actor": "...", "before": {}, "after": {}, "changedFields": [] }
  ]
}
```

### ReferenceImage (`reference_images` collection)
```json
{
  "referenceId": "ref_919d7aae",
  "caseId": "case_chen01",
  "personId": "mp_c22407e6",
  "setVersionAdded": 1,
  "setVersionRemoved": null,
  "type": "face_front | face_left | face_right | face_profile | full_body_front | full_body_back | full_body_side | last_seen_clothing | ...",
  "source": "family_upload | police | social_media | cctv_verified | other",
  "photoTakenAt": "2026-08-15T14:30:00Z",
  "uploadedBy": "Investigator",
  "uploadedAt": "2026-10-28T10:00:00Z",
  "originalUri": "http://minio:9000/reference-photos/case_chen01/ref_919d7aae.jpg",
  "normalizedUri": "http://minio:9000/reference-photos/case_chen01/ref_919d7aae.jpg",
  "thumbnailUri": "http://minio:9000/reference-photos/case_chen01/ref_919d7aae.jpg",
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "pHash": "8f3a09c21b4d8e70",
  "exifStripped": true,
  "subject": {
    "selectedFaceBox": { "x": 120, "y": 80, "width": 240, "height": 320 },
    "faceCountDetected": 1,
    "personCountDetected": 1
  },
  "analysis": {
    "status": "ready",
    "face": { "detected": true, "quality": 0.94, "blur": 0.08, "sizePx": { "width": 800, "height": 1000 }, "yawPitchRoll": [0,0,0], "usable": true },
    "body": { "detected": false, "usable": false },
    "poseBin": "front",
    "rejectReasons": [],
    "warnings": []
  },
  "embeddings": {
    "face": { "vectorId": "vec_face_919d7aae", "model": "sentinel-face-v2", "modelVersion": "v2.0" }
  },
  "isPrimary": true,
  "consistencyScore": 0.95
}
```

---

## 2. API Endpoints & Operational Flows

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/missing-persons` | Create missing person dossier (draft saves permitted; status=`draft` initially). |
| `GET` | `/missing-persons` | List dossiers with filter by `status`, `priority`, or full-text query. |
| `GET` | `/missing-persons/:id` | Fetch dossier by MongoDB `_id`, `personId`, or `caseId`. |
| `PATCH` | `/missing-persons/:id` | Partial update with `If-Match` header (optimistic concurrency, **409 Conflict** on mismatch). Writes before/after field diff audit entry. |
| `POST` | `/missing-persons/:id/submit` | Validates mandatory fields + statutory authority + $\ge 1$ usable face OR full-body reference $\rightarrow$ status=`active`. |
| `POST` | `/missing-persons/:id/last-seen` | Appends to `lastSeenHistory`, recomputes reachable area circle, and triggers auto-search if enabled. |
| `POST` | `/missing-persons/:id/status` | Transitions: `draft -> active -> under_verification -> found \| closed \| suspended`. Found/closed stops running jobs and schedules retention. |
| `GET` | `/missing-persons/:id/history` | Returns field-level before/after diff audit history. |
| `GET` | `/missing-persons/:id/readiness` | Evaluates search readiness score (0–100), breakdown, and recommendations. |
| `GET` | `/missing-persons/duplicates` | Detects potential duplicate cases using perceptual hash Hamming distance. |
| `POST` | `/references/presign` | Returns 5-minute presigned MinIO upload URL (validates size $\le 15$ MB, MIME allowlist). |
| `POST` | `/references` | Registers reference image (strips EXIF, enforces resolution bounds, detects duplicates, emits `references.uploaded`). |
| `PATCH` | `/references/:id` | Updates reference metadata (type, photoTakenAt, source, selectedFaceBox, isPrimary). |
| `DELETE` | `/references/:id` | Soft delete + retires vectors in Pinecone + bumps `referenceSetVersion`. |
| `POST` | `/references/:id/reprocess` | Re-runs biometric analysis (e.g. after manual crop). |

---

## 3. Search Readiness Score Algorithm

The readiness score quantifies whether an enrolled reference set has sufficient biometric diversity and quality for multi-camera Re-ID:

$$\text{readiness} = 100 \times \sum_{i} (w_i \times c_i)$$

Where $\sum w_i = 1.00$:

| Component | Weight ($w_i$) | Evaluation Method |
|---|---|---|
| **$c_{\text{face\_front}}$** | 0.20 | Best usable frontal face quality ($\in [0, 1]$). |
| **$c_{\text{face\_angles}}$** | 0.20 | Coverage of left/right/profile bins ($\min(1, \text{bins} / 3)$). |
| **$c_{\text{body}}$** | 0.20 | Best full-body completeness $\times$ resolution factor ($\min(1, \text{res} / 1080)$). |
| **$c_{\text{body\_views}}$** | 0.10 | Front + back + side body view coverage ($\min(1, \text{views} / 3)$). |
| **$c_{\text{clothing}}$** | 0.15 | Last-seen clothing photo ($1.0$) or detailed description ($0.85$). |
| **$c_{\text{recency}}$** | 0.10 | Exponential decay with years elapsed: $e^{-0.2 \times \text{years}}$. |
| **$c_{\text{consistency}}$** | 0.05 | Mean pairwise facial similarity within the enrolled set. |

### Generated Actionable Recommendations:
- `"Add a clear, unoccluded frontal face reference photograph."`
- `"Add left-profile or three-quarter angle facial references to improve Re-ID matching."`
- `"Add full-body standing photographs showing head-to-toe proportions."`
- `"Add back and side full-body views for multi-camera gait and posture recognition."`
- `"Enroll a photograph or detailed color description of the clothing worn when last seen."`
- `"Enrolled photographs are over X years old. Provide current pictures if available."`

---

## 4. Security & Compliance Controls

1. **Optimistic Concurrency**:
   - `If-Match` header parsed on every `PATCH /missing-persons/:id`.
   - If version mismatched, returns **409 Conflict** with message `"Version conflict: Document has been modified by another transaction"`.
2. **Field-Level AES-256-GCM Encryption**:
   - Sensitive fields (`medicalNotesEncrypted`, `phoneEncrypted`, `emailEncrypted`) encrypted with random 96-bit IVs and 128-bit authentication tags.
3. **EXIF Sanitization**:
   - Strips APP1 EXIF chunks from JPEG and `eXIf` chunks from PNG before persisting.
4. **Resolution Boundaries**:
   - Enforces minimum short side of $\ge 200\text{ px}$ for facial references and $\ge 300\text{ px}$ for full-body references.
5. **Duplicate Detection**:
   - Identical uploads prevented via cryptographic SHA-256 matching.
   - Near-duplicates detected via 64-bit difference perceptual hashing ($\text{Hamming distance} \le 4$).
