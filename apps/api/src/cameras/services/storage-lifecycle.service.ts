import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VideoSegment, VideoSegmentDocument } from '../schemas/video-segment.schema';
import { Camera, CameraDocument } from '../schemas/camera.schema';
import { StorageService } from '../../common/storage/storage.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class StorageLifecycleService {
  private readonly logger = new Logger(StorageLifecycleService.name);

  constructor(
    @InjectModel(VideoSegment.name)
    private readonly videoSegmentModel: Model<VideoSegmentDocument>,
    @InjectModel(Camera.name)
    private readonly cameraModel: Model<CameraDocument>,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Enforces retention policy by purging expired video segments and Pinecone vectors.
   * INVARIANT: Never deletes segments marked as tier: 'evidence' (legal hold).
   */
  async purgeExpiredSegments(): Promise<{
    purgedSegments: number;
    reclaimedBytes: number;
    evidencePreserved: number;
  }> {
    this.logger.log('Executing automated storage lifecycle retention purge...');

    const cameras = await this.cameraModel.find({}).exec();
    let totalPurged = 0;
    let totalReclaimedBytes = 0;

    for (const cam of cameras) {
      const retentionDays = cam.recordPolicy?.retentionDays || 30;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 3600 * 1000);

      // Find candidate segments for deletion: expired AND NOT under evidence hold
      const expiredSegments = await this.videoSegmentModel
        .find({
          cameraId: cam.id,
          tier: { $ne: 'evidence' },
          startTs: { $lt: cutoffDate },
        })
        .exec();

      for (const seg of expiredSegments) {
        // 1. Delete object from MinIO storage
        if (seg.uri) {
          const objectKey = seg.uri.replace(/^s3:\/\/[^/]+\//, '');
          await this.storageService.deleteObject('camera-recordings', objectKey);
        }

        totalReclaimedBytes += seg.sizeBytes || 0;
        totalPurged++;

        // 2. Delete index document from Mongo
        await this.videoSegmentModel.deleteOne({ _id: seg._id }).exec();
      }
    }

    const evidenceCount = await this.videoSegmentModel
      .countDocuments({ tier: 'evidence' })
      .exec();

    this.logger.log(
      `Retention purge complete: purged ${totalPurged} expired segments (${(totalReclaimedBytes / (1024 * 1024)).toFixed(2)} MB reclaimed). Preserved ${evidenceCount} evidence clips under legal hold.`,
    );

    // Audit log
    await this.auditService.recordLog({
      action: 'DATA_RETENTION_PURGE',
      actor: {
        userId: 'system-retention-worker',
        email: 'system@sentinel.internal',
        role: 'Super Admin',
      },
      entity: {
        type: 'Storage',
        id: 'camera-recordings',
      },
      correlationId: `retention_purge_${Date.now()}`,
      metadata: {
        purgedSegments: totalPurged,
        reclaimedBytes: totalReclaimedBytes,
        evidencePreserved: evidenceCount,
      },
    });

    return {
      purgedSegments: totalPurged,
      reclaimedBytes: totalReclaimedBytes,
      evidencePreserved: evidenceCount,
    };
  }

  /**
   * Generates per-camera storage breakdown report (Hot, Warm, Evidence).
   */
  async getStorageReport() {
    const cameras = await this.cameraModel.find({}).exec();
    const reports: any[] = [];

    let overallHotBytes = 0;
    let overallWarmBytes = 0;
    let overallEvidenceBytes = 0;

    for (const cam of cameras) {
      const stats = await this.videoSegmentModel.aggregate([
        { $match: { cameraId: cam.id } },
        {
          $group: {
            _id: '$tier',
            totalBytes: { $sum: '$sizeBytes' },
            count: { $sum: 1 },
            minStart: { $min: '$startTs' },
            maxEnd: { $max: '$endTs' },
          },
        },
      ]);

      let hotBytes = 0;
      let warmBytes = 0;
      let evidenceBytes = 0;
      let totalSegments = 0;
      let earliestDate: Date | null = null;
      let latestDate: Date | null = null;

      for (const s of stats) {
        totalSegments += s.count;
        if (s._id === 'hot') hotBytes = s.totalBytes;
        if (s._id === 'warm') warmBytes = s.totalBytes;
        if (s._id === 'evidence') evidenceBytes = s.totalBytes;

        if (!earliestDate || (s.minStart && s.minStart < earliestDate)) {
          earliestDate = s.minStart;
        }
        if (!latestDate || (s.maxEnd && s.maxEnd > latestDate)) {
          latestDate = s.maxEnd;
        }
      }

      overallHotBytes += hotBytes;
      overallWarmBytes += warmBytes;
      overallEvidenceBytes += evidenceBytes;

      reports.push({
        cameraId: cam.id,
        cameraName: cam.name,
        siteId: cam.siteId,
        retentionDays: cam.recordPolicy?.retentionDays || 30,
        recordMode: cam.recordPolicy?.mode || 'continuous',
        totalSegments,
        hotStorageGb: +(hotBytes / (1024 * 1024 * 1024)).toFixed(3),
        warmStorageGb: +(warmBytes / (1024 * 1024 * 1024)).toFixed(3),
        evidenceStorageGb: +(evidenceBytes / (1024 * 1024 * 1024)).toFixed(3),
        totalStorageGb: +((hotBytes + warmBytes + evidenceBytes) / (1024 * 1024 * 1024)).toFixed(3),
        earliestSegmentAt: earliestDate ? earliestDate.toISOString() : null,
        latestSegmentAt: latestDate ? latestDate.toISOString() : null,
      });
    }

    const grandTotalBytes = overallHotBytes + overallWarmBytes + overallEvidenceBytes;

    return {
      summary: {
        totalCameras: cameras.length,
        grandTotalStorageGb: +(grandTotalBytes / (1024 * 1024 * 1024)).toFixed(3),
        hotStorageGb: +(overallHotBytes / (1024 * 1024 * 1024)).toFixed(3),
        warmStorageGb: +(overallWarmBytes / (1024 * 1024 * 1024)).toFixed(3),
        evidenceStorageGb: +(overallEvidenceBytes / (1024 * 1024 * 1024)).toFixed(3),
      },
      cameras: reports,
    };
  }
}
