export interface EmailMessage {
  recipient: {
    email: string;
    name?: string;
  };
  subject: string;
  htmlContent: string;
  textContent?: string;
  tags?: string[];
  idempotencyKey?: string;
}

export interface SendEmailResult {
  messageId: string;
  status: 'sent' | 'queued';
}
