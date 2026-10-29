import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PdfDossierService } from './services/pdf-dossier.service';
import { SystemReport, SystemReportDocument } from './schemas/report.schema';
import { CasesService } from '../cases/cases.service';
import { JourneysService } from '../journeys/journeys.service';
import { EvidenceService } from '../evidence/evidence.service';

export interface ReportJobData {
  reportId: string;
  caseId: string;
  title: string;
  requestedBy: string;
}

@Injectable()
export class ReportsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsProcessor.name);
  private worker: Worker | null = null;
  // Local in-memory store for generated PDF buffers
  public static generatedPdfs = new Map<string, Buffer>();

  constructor(
    private readonly configService: ConfigService,
    private readonly pdfService: PdfDossierService,
    private readonly casesService: CasesService,
    private readonly journeysService: JourneysService,
    private readonly evidenceService: EvidenceService,
    @InjectModel(SystemReport.name)
    private readonly reportModel: Model<SystemReportDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('app.redisHost', 'localhost');
    const port = this.configService.get<number>('app.redisPort', 6379);

    try {
      this.worker = new Worker(
        'report',
        async (job: Job<ReportJobData>) => {
          return this.processReportJob(job.data);
        },
        {
          connection: {
            host,
            port,
            maxRetriesPerRequest: null,
            connectTimeout: 1000,
            retryStrategy: () => null,
            lazyConnect: true,
          },
          concurrency: 2,
        },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(`Report generation job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Report generation job ${job?.id} failed: ${err.message}`);
      });

      this.worker.on('error', (err) => {
        // Suppress unhandled connection errors during shutdown or offline dev
      });
    } catch (err: any) {
      this.logger.warn(`Could not start BullMQ Report Worker: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close().catch(() => null);
    }
  }

  async processReportJob(data: ReportJobData): Promise<string> {
    this.logger.log(`Generating PDF case dossier for report ${data.reportId} (case ${data.caseId})`);

    const c = await this.casesService.findById(data.caseId);
    const journey = await this.journeysService.getJourneyForCase(data.caseId);
    const evidenceList = await this.evidenceService.findAll({ caseId: data.caseId });

    const pdfBuffer = await this.pdfService.generateDossierPdf({
      caseId: data.caseId,
      caseNumber: c?.caseNumber || 'MP-UNKNOWN',
      title: c?.title || data.title,
      personName: c?.personName || 'Subject',
      age: c?.age || 0,
      gender: c?.gender || 'unknown',
      lastSeenLocation: c?.lastSeenLocation || 'N/A',
      priority: c?.priority || 'medium',
      status: c?.status || 'active',
      journeyNodes: journey.nodes.map((n) => ({
        order: n.order,
        cameraId: n.cameraId,
        cameraLocation: n.locationName,
        timestamp: n.timestamp,
        fusedScore: n.fusedScore,
        status: n.status,
      })),
      evidenceItems: evidenceList.map((e) => ({
        id: e.id,
        cameraId: e.cameraId,
        sha256Hash: e.sha256OriginalFrame || e.sha256Hash,
        sha256Crop: e.sha256Crop,
        capturedAt: e.capturedAt,
        fusedScore: e.scores?.fusedScore || 0,
        isRedacted: e.isRedacted,
        chainOfCustody: e.chainOfCustody || [],
      })),
      generatedBy: data.requestedBy,
      generatedAt: new Date().toISOString(),
    });

    // Store buffer in memory for instant download
    ReportsProcessor.generatedPdfs.set(data.reportId, pdfBuffer);

    // Update Report record in Mongo
    const sizeMb = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
    const downloadUrl = `/api/v1/reports/${data.reportId}/download?expires=${Date.now() + 3600000}`;

    await this.reportModel.updateOne(
      { id: data.reportId },
      {
        $set: {
          fileSize: `${sizeMb} MB`,
          downloadUrl,
          generatedAt: new Date().toISOString(),
        },
      },
    );

    return downloadUrl;
  }
}
