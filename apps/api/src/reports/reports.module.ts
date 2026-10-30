import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemReport, SystemReportSchema } from './schemas/report.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';
import { PdfDossierService } from './services/pdf-dossier.service';
import { QueueModule } from '../common/queues/queue.module';
import { CasesModule } from '../cases/cases.module';
import { JourneysModule } from '../journeys/journeys.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemReport.name, schema: SystemReportSchema },
    ]),
    QueueModule,
    CasesModule,
    JourneysModule,
    EvidenceModule,
    StorageModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor, PdfDossierService],
  exports: [ReportsService, ReportsProcessor, PdfDossierService, MongooseModule],
})
export class ReportsModule {}
