import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailMessage, SendEmailResult } from '../brevo/brevo.types';
import { MailTransport } from '../transport/mail-transport.interface';

@Injectable()
export class SmtpDevService implements MailTransport {
  private readonly logger = new Logger(SmtpDevService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly sender: { name: string; email: string };

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('email.smtpDev.host') || this.configService.get<string>('app.smtpDevHost') || 'localhost';
    const port = this.configService.get<number>('email.smtpDev.port') || this.configService.get<number>('app.smtpDevPort') || 1025;

    this.sender = {
      name: this.configService.get<string>('email.sender.name') ?? 'Sentinel Vision AI',
      email: this.configService.get<string>('email.sender.email') ?? 'notifications@sentinelvision.ai',
    };

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true,
    });
  }

  async sendEmail(options: EmailMessage): Promise<SendEmailResult> {
    const recipientDomain = options.recipient.email.includes('@')
      ? options.recipient.email.split('@')[1]
      : 'unknown-domain';

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.sender.name}" <${this.sender.email}>`,
        to: options.recipient.name
          ? `"${options.recipient.name}" <${options.recipient.email}>`
          : options.recipient.email,
        subject: options.subject,
        html: options.htmlContent,
        text: options.textContent,
      });

      const messageId = info.messageId || `smtp_dev_${Date.now()}`;
      this.logger.log(`Email dispatched via SmtpDev (Mailpit) | messageId=${messageId} recipientDomain=@${recipientDomain}`);

      return {
        messageId,
        status: 'sent',
      };
    } catch (error: any) {
      this.logger.error(
        `SMTP Dev dispatch error | recipientDomain=@${recipientDomain} message=${error?.message ?? error}`,
      );
      throw error;
    }
  }

  async sendBulkEmails(messages: EmailMessage[]): Promise<PromiseSettledResult<SendEmailResult>[]> {
    return Promise.allSettled(messages.map((msg) => this.sendEmail(msg)));
  }
}
