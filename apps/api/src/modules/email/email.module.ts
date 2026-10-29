import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { emailConfig } from './email.config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { BrevoService } from './brevo/brevo.service';
import { SmtpDevService } from './smtp-dev/smtp-dev.service';
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
    SmtpDevService,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService, BrevoService, SmtpDevService],
      useFactory: (config: ConfigService, brevo: BrevoService, smtpDev: SmtpDevService) => {
        const transport = config.get<string>('email.transport') || config.get<string>('app.emailTransport') || 'smtp-dev';
        return transport === 'brevo' ? brevo : smtpDev;
      },
    },
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService, MAIL_TRANSPORT],
})
export class EmailModule {}
