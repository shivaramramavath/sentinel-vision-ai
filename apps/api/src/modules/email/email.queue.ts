import { TemplateId, TemplateData } from './templates';

export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_DLQ_NAME = 'email-failed';

export interface EmailJobData<T extends TemplateId = TemplateId> {
  templateId: T;
  data: TemplateData<T>;
  recipientEmail: string;
  recipientName?: string;
  idempotencyKey?: string;
  tags?: string[];
}

export const EMAIL_DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 200,
  removeOnFail: 1000, // kept in DLQ for forensics
};
