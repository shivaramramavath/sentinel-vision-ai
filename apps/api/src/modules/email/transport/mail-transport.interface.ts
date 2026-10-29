import { EmailMessage, SendEmailResult } from '../brevo/brevo.types';

export interface MailTransport {
  sendEmail(options: EmailMessage): Promise<SendEmailResult>;
  sendBulkEmails?(messages: EmailMessage[]): Promise<PromiseSettledResult<SendEmailResult>[]>;
}

export const MAIL_TRANSPORT = 'MAIL_TRANSPORT';
