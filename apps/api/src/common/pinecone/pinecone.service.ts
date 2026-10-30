import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone, Index } from '@pinecone-database/pinecone';

@Injectable()
export class PineconeService implements OnModuleInit {
  private readonly logger = new Logger(PineconeService.name);
  private client: Pinecone | null = null;
  private faceIndex: Index | null = null;
  private reidIndex: Index | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const apiKey = this.configService.get<string>('pinecone.apiKey');
    const faceDim = this.configService.get<number>('pinecone.faceDim', 512);
    const reidDim = this.configService.get<number>('pinecone.reidDim', 512);

    if (faceDim !== 512 || reidDim !== 512) {
      throw new Error(
        `Pinecone model dimension mismatch! Neural model registry requires 512 for face and 512 for Re-ID. Configured: face=${faceDim}, reid=${reidDim}`,
      );
    }

    if (!apiKey) {
      this.logger.warn('PINECONE_API_KEY is not configured. Pinecone service running in stub/mock mode.');
      return;
    }

    try {
      this.client = new Pinecone({ apiKey });
      const faceIndexName = this.configService.get<string>('pinecone.indexFace', 'face-embeddings');
      const reidIndexName = this.configService.get<string>('pinecone.indexReid', 'reid-embeddings');

      this.faceIndex = this.client.index(faceIndexName);
      this.reidIndex = this.client.index(reidIndexName);
      this.logger.log(`Pinecone client initialized for indexes: [${faceIndexName}, ${reidIndexName}]`);
    } catch (err: any) {
      this.logger.error(`Failed to initialize Pinecone client: ${err.message}`);
    }
  }

  getClient(): Pinecone | null {
    return this.client;
  }

  getFaceIndex(): Index | null {
    return this.faceIndex;
  }

  getReidIndex(): Index | null {
    return this.reidIndex;
  }

  getCaseNamespace(caseId: string): string {
    const prefix = this.configService.get<string>('pinecone.namespacePrefix', 'sentinel');
    return `${prefix}-case-${caseId}`;
  }

  getFootageNamespace(yyyymmdd: string): string {
    const prefix = this.configService.get<string>('pinecone.namespacePrefix', 'sentinel');
    return `${prefix}-footage-${yyyymmdd}`;
  }
}
