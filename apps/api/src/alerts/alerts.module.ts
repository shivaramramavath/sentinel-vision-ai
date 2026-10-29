import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemAlert, SystemAlertSchema } from './schemas/alert.schema';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemAlert.name, schema: SystemAlertSchema },
    ]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService, MongooseModule],
})
export class AlertsModule {}
