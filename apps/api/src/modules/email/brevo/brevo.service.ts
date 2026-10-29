import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient, BrevoError } from '@getbrevo/brevo';
import { EmailMessage, SendEmailResult } from './brevo.types';
import { MailTransport } from '../transport/mail-transport.interface';

@Injectable()
export class BrevoService implements MailTransport {
  private readonly logger = new Logger(BrevoService.name);
  private readonly client: BrevoClient;
  private readonly sender: { name: string; email: string };

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.apiKey') || this.configService.get<string>('app.brevoApiKey') || '';
    const timeout = this.configService.get<number>('email.timeout') ?? 10;
    const maxRetries = this.configService.get<number>('email.maxRetries') ?? 2;

    this.sender = {
      name: this.configService.get<string>('email.sender.name') ?? 'Sentinel Vision AI',
      email: this.configService.get<string>('email.sender.email') ?? 'notifications@sentinelvision.ai',
    };

    this.client = new BrevoClient({
      apiKey,
      timeoutInSeconds: timeout,
      maxRetries,
    });
  }

  /**
   * Sends a single transactional email via Brevo.
   * Logs ONLY the recipient domain for privacy.
   * Rethrows all errors so BullMQ retry policy can take effect.
   */
  async sendEmail(options: EmailMessage): Promise<SendEmailResult> {
    const recipientDomain = options.recipient.email.includes('@')
      ? options.recipient.email.split('@')[1]
      : 'unknown-domain';

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail({
        sender: this.sender,
        to: [
          {
            email: options.recipient.email,
            name: options.recipient.name,
          },
        ],
        subject: options.subject,
        htmlContent: options.htmlContent,
        textContent: options.textContent,
        tags: options.tags,
      });

      const messageId = (response as any)?.messageId || `brevo_${Date.now()}`;
      this.logger.log(`Email dispatched via Brevo | messageId=${messageId} recipientDomain=@${recipientDomain}`);

      return {
        messageId,
        status: 'sent',
      };
    } catch (error: any) {
      if (error instanceof BrevoError) {
        this.logger.error(
          `Brevo API error | statusCode=${error.statusCode} recipientDomain=@${recipientDomain} message=${error.message}`,
        );
      } else {
        this.logger.error(
          `Unknown Brevo dispatch error | recipientDomain=@${recipientDomain} message=${error?.message ?? error}`,
        );
      }
      // Rethrow so BullMQ exponential backoff and DLQ handle the failure
      throw error;
    }
  }

  /**
   * Bulk dispatch using Promise.allSettled
   */
  async sendBulkEmails(messages: EmailMessage[]): Promise<PromiseSettledResult<SendEmailResult>[]> {
    return Promise.allSettled(messages.map((msg) => this.sendEmail(msg)));
  }
}
