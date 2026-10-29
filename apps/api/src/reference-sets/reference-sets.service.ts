import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReferenceSet, ReferenceSetDocument } from './schemas/reference-set.schema';
import { ReferenceImage, ReferenceImageDocument } from '../references/schemas/reference-image.schema';
import { MissingPerson, MissingPersonDocument } from '../missing-persons/schemas/missing-person.schema';
import { KafkaService } from '../common/kafka/kafka.service';
import { computeReadinessScore, ReadinessEvaluation } from './readiness-calculator.util';

@Injectable()
export class ReferenceSetsService {
  private readonly logger = new Logger(ReferenceSetsService.name);

  constructor(
    @InjectModel(ReferenceSet.name)
    private readonly referenceSetModel: Model<ReferenceSetDocument>,
    @InjectModel(ReferenceImage.name)
    private readonly referenceImageModel: Model<ReferenceImageDocument>,
    @InjectModel(MissingPerson.name)
    private readonly missingPersonModel: Model<MissingPersonDocument>,
    private readonly kafkaService: KafkaService,
  ) {}

  async syncReferenceSet(
    caseId: string,
    personId: string,
    newVersion: number,
  ): Promise<ReferenceSetDocument> {
    const references = await this.referenceImageModel
      .find({
        caseId,
        deletedAt: null,
      })
      .exec();

    const missingPerson = await this.missingPersonModel.findOne({ caseId }).exec();

    const evaluation = computeReadinessScore(references, missingPerson);

    const items = references.map((r) => ({
      referenceId: r.referenceId,
      type: r.type,
      uri: r.normalizedUri || r.originalUri,
      isPrimary: r.isPrimary,
      consistencyScore: r.consistencyScore,
      poseBin: r.analysis?.poseBin,
    }));

    const pineconeNamespace = `case_${caseId}_v${newVersion}`;

    const setDoc = new this.referenceSetModel({
      caseId,
      personId,
      version: newVersion,
      references: items,
      readinessScore: evaluation.readinessScore,
      readinessBreakdown: evaluation.breakdown,
      weights: evaluation.weights,
      recommendations: evaluation.recommendations,
      pineconeNamespace,
      syncedAt: new Date().toISOString(),
    });

    const saved = await setDoc.save();

    // Publish Kafka event for incremental embedding & Pinecone namespace synchronization
    await this.kafkaService.publishEvent('case.events', {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: 'case.reference_set.updated',
      timestamp: new Date().toISOString(),
      caseId,
      data: {
        caseId,
        personId,
        version: newVersion,
        pineconeNamespace,
        retireNamespace: `case_${caseId}_v${Math.max(1, newVersion - 1)}`,
        readinessScore: evaluation.readinessScore,
        activeReferencesCount: references.length,
        references: items,
      },
    } as any, caseId);

    this.logger.log(
      `Synchronized ReferenceSet v${newVersion} for case ${caseId} (Readiness: ${evaluation.readinessScore}%, Photos: ${references.length})`,
    );

    return saved;
  }

  async getLatestSet(caseId: string): Promise<ReferenceSetDocument | null> {
    return this.referenceSetModel
      .findOne({ caseId })
      .sort({ version: -1 })
      .exec();
  }

  async evaluateReadiness(caseId: string): Promise<ReadinessEvaluation> {
    const references = await this.referenceImageModel
      .find({
        caseId,
        deletedAt: null,
      })
      .exec();

    const missingPerson = await this.missingPersonModel.findOne({ caseId }).exec();

    return computeReadinessScore(references, missingPerson);
  }
}
