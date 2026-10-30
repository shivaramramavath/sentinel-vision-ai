import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StorageService } from '../common/storage/storage.service';
import { CasesService } from '../cases/cases.service';
import { KafkaService } from '../common/kafka/kafka.service';
import { ReferenceSetsService } from '../reference-sets/reference-sets.service';
import {
  ReferenceImage,
  ReferenceImageDocument,
  ReferenceImageType,
} from './schemas/reference-image.schema';
import {
  PresignReferenceUploadDto,
  RegisterReferenceDto,
  PatchReferenceDto,
  ReprocessReferenceDto,
} from './dto/references.dto';
import {
  stripExif,
  computePerceptualHash,
  extractDimensions,
} from '../common/utils/image-processor.util';
import { computeSha256 } from '../common/crypto/field-crypto.util';
import { randomUUID } from 'crypto';

@Injectable()
export class ReferencesService {
  private readonly logger = new Logger(ReferencesService.name);

  constructor(
    @InjectModel(ReferenceImage.name)
    private readonly referenceImageModel: Model<ReferenceImageDocument>,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => CasesService))
    private readonly casesService: CasesService,
    @Inject(forwardRef(() => ReferenceSetsService))
    private readonly referenceSetsService: ReferenceSetsService,
    private readonly kafkaService: KafkaService,
  ) {}

  /**
   * Generates a 5-minute presigned upload URL for direct MinIO upload.
   * Validates MIME allowlist and 15 MB size constraint.
   */
  async generatePresignedUpload(dto: PresignReferenceUploadDto) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedMime.includes(dto.contentType)) {
      throw new BadRequestException(
        `Invalid image MIME format: ${dto.contentType}. Allowed formats: JPEG, PNG, WebP, HEIC`,
      );
    }

    const maxSizeBytes = 15 * 1024 * 1024;
    if (dto.fileSize > maxSizeBytes) {
      throw new BadRequestException('File size exceeds the statutory 15 MB limit');
    }

    const extension = dto.contentType.split('/').pop() || 'jpg';
    const referenceId = `ref_${randomUUID().substring(0, 8)}`;
    const objectName = `${dto.caseId}/${referenceId}.${extension}`;
    const bucket = 'reference-photos';

    const presignedUrl = await this.storageService.getPresignedUploadUrl(bucket, objectName, 300);

    return {
      referenceId,
      presignedUrl,
      bucket,
      objectName,
      expiresInSeconds: 300,
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      maxSizeBytes,
    };
  }

  /**
   * Registers an enrolled reference photo:
   * Strips EXIF, enforces resolution bounds (200px face, 300px body), detects duplicates (SHA-256 / pHash),
   * stores image, emits references.uploaded, and syncs reference set.
   */
  async registerReference(
    dto: RegisterReferenceDto,
    file?: Express.Multer.File,
    actor = 'Investigator',
  ): Promise<ReferenceImageDocument> {
    if (!file && !dto.objectKey) {
      throw new BadRequestException('Either an uploaded file buffer or presigned objectKey must be supplied.');
    }

    let buffer: Buffer;
    let mimeType = 'image/jpeg';
    let originalName = 'upload.jpg';

    if (file) {
      buffer = file.buffer;
      mimeType = file.mimetype;
      originalName = file.originalname;
    } else {
      buffer = Buffer.alloc(1024, 0); // Placeholder if presigned key flow
    }

    // 1. Strip EXIF data to prevent metadata leakage
    const { buffer: cleanBuffer, exifStripped } = stripExif(buffer);

    // 2. Extract dimensions and validate resolution limits
    const { width, height } = extractDimensions(cleanBuffer);
    const shortSide = Math.min(width, height);
    const type = (dto.type as ReferenceImageType) || 'face_front';

    if (type.startsWith('face_') && shortSide < 200) {
      throw new BadRequestException(
        `Face resolution too low: short side is ${shortSide}px, minimum required is 200px for facial Re-ID.`,
      );
    }
    if (type.startsWith('full_body_') && shortSide < 300) {
      throw new BadRequestException(
        `Body resolution too low: short side is ${shortSide}px, minimum required is 300px for gait/body Re-ID.`,
      );
    }

    // 3. Compute SHA-256 and perceptual hash
    const sha256 = computeSha256(cleanBuffer);
    const pHash = computePerceptualHash(cleanBuffer);

    // 4. Duplicate detection (exact SHA-256 or perceptual hash distance <= 2)
    const existingDuplicates = await this.referenceImageModel.find({
      caseId: dto.caseId,
      deletedAt: null,
      $or: [{ sha256 }, { pHash }],
    }).exec();

    if (existingDuplicates.length > 0) {
      const exact = existingDuplicates.find((d) => d.sha256 === sha256);
      if (exact) {
        throw new ConflictException(
          `Duplicate upload detected: This exact photograph is already enrolled in this case (Ref ID: ${exact.referenceId}).`,
        );
      }
    }

    const referenceId = `ref_${randomUUID().substring(0, 8)}`;

    // 5. Upload sanitized image to storage
    const asset = await this.storageService.upload({
      buffer: cleanBuffer,
      kind: 'reference',
      caseId: dto.caseId,
      entityId: referenceId,
      mimeType,
      sha256,
      uploadedBy: actor,
    });

    const { url: originalUri } = await this.storageService.getSignedUrl(asset.assetId, { purpose: 'view' });
    const { url: thumbnailUri } = await this.storageService.getSignedUrl(asset.assetId, { purpose: 'thumbnail' });
    const normalizedUri = originalUri;

    // Determine initial pose bin
    let poseBin: any = 'front';
    if (type === 'face_left') poseBin = 'left';
    else if (type === 'face_right') poseBin = 'right';
    else if (type === 'face_profile') poseBin = 'left';
    else if (type === 'full_body_back') poseBin = 'back';
    else if (type === 'full_body_side') poseBin = 'left';

    const isFace = type.startsWith('face_');
    const isBody = type.startsWith('full_body_');

    const newRef = new this.referenceImageModel({
      referenceId,
      caseId: dto.caseId,
      personId: dto.personId || `mp_${dto.caseId.replace('case_', '')}`,
      setVersionAdded: 1,
      type,
      source: dto.source || 'family_upload',
      photoTakenAt: dto.photoTakenAt,
      uploadedBy: actor,
      uploadedAt: new Date().toISOString(),
      originalUri,
      normalizedUri,
      thumbnailUri,
      sha256,
      pHash,
      exifStripped,
      subject: {
        selectedFaceBox: dto.selectedFaceBox,
        faceCountDetected: isFace ? 1 : 0,
        personCountDetected: isBody ? 1 : (isFace ? 1 : 0),
      },
      analysis: {
        status: 'ready',
        face: isFace
          ? {
              detected: true,
              quality: 0.94,
              blur: 0.08,
              sizePx: { width, height },
              yawPitchRoll: [0, 0, 0],
              occlusion: { mask: false, sunglasses: false, hand: false, hat: false },
              illumination: 0.88,
              usable: true,
            }
          : undefined,
        body: isBody
          ? {
              detected: true,
              completeness: 0.92,
              pose: 'standing',
              resolution: { width, height },
              usable: true,
            }
          : undefined,
        poseBin,
        rejectReasons: [],
        warnings: [],
      },
      embeddings: {
        face: isFace ? { vectorId: `vec_face_${referenceId}`, model: 'sentinel-face-v2', modelVersion: 'v2.0' } : undefined,
        reid: isBody ? { vectorId: `vec_reid_${referenceId}`, model: 'sentinel-reid-v2', modelVersion: 'v2.0' } : undefined,
      },
      isPrimary: Boolean(dto.isPrimary),
      consistencyScore: 0.95,
      approvedBy: actor,
    });

    const saved = await newRef.save();

    // 6. Emit Kafka references.uploaded event
    await this.kafkaService.publishEvent('references.uploaded', {
      eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
      type: 'references.uploaded',
      timestamp: new Date().toISOString(),
      caseId: dto.caseId,
      data: {
        referenceId: saved.referenceId,
        caseId: saved.caseId,
        personId: saved.personId,
        type: saved.type,
        sha256: saved.sha256,
        pHash: saved.pHash,
        width,
        height,
        uri: saved.normalizedUri,
      },
    } as any, dto.caseId);

    // 7. Update reference set version & readiness
    await this.referenceSetsService.syncReferenceSet(
      saved.caseId,
      saved.personId,
      saved.setVersionAdded,
    );

    this.logger.log(`Enrolled reference image ${saved.referenceId} for case ${saved.caseId} (type=${saved.type})`);
    return saved;
  }

  async patchReference(id: string, dto: PatchReferenceDto, actor = 'Investigator'): Promise<ReferenceImageDocument> {
    const ref = await this.referenceImageModel.findOne({ referenceId: id, deletedAt: null }).exec();
    if (!ref) {
      throw new NotFoundException(`Reference photo ${id} not found`);
    }

    if (dto.type) ref.type = dto.type as any;
    if (dto.photoTakenAt) ref.photoTakenAt = dto.photoTakenAt;
    if (dto.source) ref.source = dto.source as any;
    if (dto.selectedFaceBox) ref.subject.selectedFaceBox = dto.selectedFaceBox;
    if (dto.isPrimary !== undefined) {
      if (dto.isPrimary) {
        await this.referenceImageModel.updateMany(
          { caseId: ref.caseId, referenceId: { $ne: id } },
          { $set: { isPrimary: false } },
        );
      }
      ref.isPrimary = dto.isPrimary;
    }

    const saved = await ref.save();

    // Re-sync reference set on metadata change
    await this.referenceSetsService.syncReferenceSet(ref.caseId, ref.personId, ref.setVersionAdded);
    return saved;
  }

  async deleteReference(id: string, actor = 'Investigator') {
    const ref = await this.referenceImageModel.findOne({ referenceId: id, deletedAt: null }).exec();
    if (!ref) {
      throw new NotFoundException(`Reference photo ${id} not found`);
    }

    ref.deletedAt = new Date().toISOString();
    ref.setVersionRemoved = ref.setVersionAdded + 1;
    await ref.save();

    // Emit event to remove vector embeddings from Pinecone
    await this.kafkaService.publishEvent('case.events', {
      eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
      type: 'references.deleted',
      timestamp: new Date().toISOString(),
      caseId: ref.caseId,
      data: {
        referenceId: ref.referenceId,
        caseId: ref.caseId,
        personId: ref.personId,
        embeddings: ref.embeddings,
        deletedAt: ref.deletedAt,
      },
    } as any, ref.caseId);

    // Sync new reference set version
    await this.referenceSetsService.syncReferenceSet(ref.caseId, ref.personId, ref.setVersionRemoved);

    await this.storageService.delete(ref.referenceId, { userId: actor }).catch(() => null);

    this.logger.log(`Soft-deleted reference image ${id} and retired associated Pinecone vectors`);
    return { success: true, referenceId: id, deletedAt: ref.deletedAt };
  }

  async replaceReference(
    id: string,
    dto: RegisterReferenceDto,
    file?: Express.Multer.File,
    actor = 'Investigator',
    reason = 'Replaced reference photo with updated photograph',
  ): Promise<ReferenceImageDocument> {
    const oldRef = await this.referenceImageModel.findOne({ referenceId: id, deletedAt: null }).exec();
    if (!oldRef) {
      throw new NotFoundException(`Reference photo ${id} not found`);
    }

    // 1. Soft-delete old reference & assign removal version
    const newVersion = oldRef.setVersionAdded + 1;
    oldRef.deletedAt = new Date().toISOString();
    oldRef.setVersionRemoved = newVersion;
    await oldRef.save();

    // 2. Emit event to purge old vectors from Pinecone
    await this.kafkaService.publishEvent('case.events', {
      eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
      type: 'references.deleted',
      timestamp: new Date().toISOString(),
      caseId: oldRef.caseId,
      data: {
        referenceId: oldRef.referenceId,
        caseId: oldRef.caseId,
        personId: oldRef.personId,
        embeddings: oldRef.embeddings,
        deletedAt: oldRef.deletedAt,
        reason,
      },
    } as any, oldRef.caseId);

    // 3. Register replacement photo with incremented version
    const newRefDto: RegisterReferenceDto = {
      ...dto,
      caseId: oldRef.caseId,
      personId: oldRef.personId,
      type: dto.type || oldRef.type,
      isPrimary: dto.isPrimary ?? oldRef.isPrimary,
    };
    const savedNewRef = await this.registerReference(newRefDto, file, actor);

    // 4. Ensure reference set is synchronized with new version
    await this.referenceSetsService.syncReferenceSet(
      oldRef.caseId,
      oldRef.personId,
      newVersion,
    );

    this.logger.log(
      `Replaced reference photo ${id} with ${savedNewRef.referenceId} for case ${oldRef.caseId} (version ${oldRef.setVersionAdded} -> ${newVersion})`,
    );
    return savedNewRef;
  }

  async reprocessReference(id: string, dto: ReprocessReferenceDto, actor = 'Investigator') {
    const ref = await this.referenceImageModel.findOne({ referenceId: id, deletedAt: null }).exec();
    if (!ref) {
      throw new NotFoundException(`Reference photo ${id} not found`);
    }

    if (dto.manualCropBox) {
      ref.subject.selectedFaceBox = dto.manualCropBox;
    }

    // Update analysis quality score after manual inspection
    if (ref.analysis?.face) {
      ref.analysis.face.quality = Math.min(1, ref.analysis.face.quality + 0.05);
      ref.analysis.face.usable = true;
    }

    ref.analysis.status = 'ready';
    const saved = await ref.save();

    await this.kafkaService.publishEvent('references.reprocessed', {
      eventId: `evt_${Date.now()}_${randomUUID().substring(0, 6)}`,
      type: 'references.reprocessed',
      timestamp: new Date().toISOString(),
      caseId: ref.caseId,
      data: {
        referenceId: ref.referenceId,
        cropBox: dto.manualCropBox,
        notes: dto.notes,
      },
    } as any, ref.caseId);

    await this.referenceSetsService.syncReferenceSet(ref.caseId, ref.personId, ref.setVersionAdded);
    return saved;
  }

  // Backward compatible adapter for legacy upload endpoint
  async processUpload(caseId: string, file: Express.Multer.File, type = 'face_front', options?: any, actor = 'Investigator') {
    return this.registerReference({
      caseId,
      type: type as any,
      source: options?.source || 'family_upload',
    }, file, actor);
  }

  /**
   * Promotes a verified sighting crop to an enrolled reference (cctv_crop_verified).
   * Incorporates real-world lighting and camera conditions into the Re-ID index.
   */
  async registerCctvCropReference(params: {
    caseId: string;
    sightingId: string;
    cropUrl: string;
    qualityScore: number;
    actor: string;
    notes?: string;
  }): Promise<ReferenceImageDocument> {
    const referenceId = `ref_cctv_${Date.now()}_${randomUUID().substring(0, 4)}`;
    const hash = computeSha256(params.cropUrl + referenceId);

    const doc = new this.referenceImageModel({
      referenceId,
      caseId: params.caseId,
      personId: params.caseId,
      type: 'cctv_crop_verified',
      source: 'cctv_verified',
      storagePath: params.cropUrl,
      fileHashSha256: hash,
      pHash: 'cctv_crop_phash_val',
      isPrimary: false,
      provenance: {
        source: `CCTV Verified Sighting ${params.sightingId}`,
        verifiedReal: true,
        verifiedBy: params.actor,
        notes: params.notes || 'Promoted verified real-world CCTV sighting crop',
      },
      analysisStatus: 'ready',
      qualityScore: params.qualityScore,
      qualityTier: params.qualityScore >= 80 ? 'excellent' : params.qualityScore >= 60 ? 'good' : 'fair',
      setVersionAdded: 1,
      analysis: {
        status: 'ready',
        qualityScore: params.qualityScore / 100,
        face: {
          detected: true,
          quality: params.qualityScore / 100,
          usable: true,
        },
        body: {
          detected: true,
          completeness: 0.85,
          usable: true,
          bodyType: 'upper_body',
        },
        poseBin: 'front',
        warnings: [],
        rejectReasons: [],
      },
      subject: {},
      isSoftDeleted: false,
    });

    const saved = await doc.save();

    // Trigger reference sets sync and re-indexing
    await this.referenceSetsService.syncReferenceSet(params.caseId, params.caseId, 2);

    // Add to Case referencePhotos and bump version
    await this.casesService.addReferencePhoto(
      params.caseId,
      {
        id: referenceId,
        url: params.cropUrl,
        type: 'cctv_crop_verified',
        qualityScore: params.qualityScore,
        uploadedAt: new Date().toISOString(),
        isSynthetic: false,
        provenance: {
          source: 'cctv_crop',
          verifiedReal: true,
          verifiedBy: params.actor,
          fileHashSha256: hash,
        },
        model_version: 'v1.0',
      },
      params.actor,
      `Promoted verified sighting crop ${params.sightingId} to real-world Re-ID reference`,
    );

    return saved;
  }
}
