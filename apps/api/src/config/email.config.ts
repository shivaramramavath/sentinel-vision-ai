import { registerAs } from '@nestjs/config';

export interface EmailConfig {
  apiKey: string;
  timeoutSeconds: number;
  maxRetries: number;
  sender: {
    name: string;
    email: string;
  };
  ratePerMinute: number;
  dailyCap: number;
  webhookSecret: string;
}

export const emailConfig = registerAs('email', (): EmailConfig => ({
  apiKey: process.env.BREVO_API_KEY ?? '',
  timeoutSeconds: parseInt(process.env.BREVO_TIMEOUT_SECONDS ?? '10', 10),
  maxRetries: parseInt(process.env.BREVO_MAX_RETRIES ?? '5', 10),
  sender: {
    name: process.env.BREVO_SENDER_NAME ?? '',
    email: process.env.BREVO_SENDER_EMAIL ?? '',
  },
  ratePerMinute: parseInt(process.env.EMAIL_RATE_PER_MINUTE ?? '20', 10),
  dailyCap: parseInt(process.env.EMAIL_DAILY_CAP ?? '250', 10),
  webhookSecret: process.env.BREVO_WEBHOOK_SECRET ?? '',
}));
