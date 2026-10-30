import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { emailConfig } from '../../config/email.config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { BrevoService } from './brevo/brevo.service';

import { MAIL_TRANSPORT } from './transport/mail-transport.interface';
import { EmailLog, EmailLogSchema } from './schemas/email-log.schema';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(emailConfig),
    MongooseModule.forFeature([{ name: EmailLog.name, schema: EmailLogSchema }]),
  ],
  providers: [
    BrevoService,

    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService, BrevoService],
      useFactory: (config: ConfigService, brevo: BrevoService) => {
        // Email transport is now always Brevo. Retain config lookup for backward compatibility.
        const transport = config.get<string>('email.transport') || config.get<string>('app.emailTransport') || 'brevo';
        return transport === 'brevo' ? brevo : brevo; // fallback to brevo
      },
    },
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService, MAIL_TRANSPORT],
})
export class EmailModule {}
