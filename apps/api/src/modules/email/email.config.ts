import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  apiKey: process.env.BREVO_API_KEY ?? '',
  timeout: parseInt(process.env.BREVO_TIMEOUT_SECONDS ?? '10', 10),
  maxRetries: parseInt(process.env.BREVO_MAX_RETRIES ?? '2', 10),
  sender: {
    name: process.env.BREVO_SENDER_NAME ?? 'Sentinel Vision AI',
    email: process.env.BREVO_SENDER_EMAIL ?? 'notifications@sentinelvision.ai',
  },
  transport: (process.env.EMAIL_TRANSPORT ?? (process.env.BREVO_API_KEY ? 'brevo' : 'smtp-dev')) as 'brevo' | 'smtp-dev',
  smtpDev: {
    host: process.env.SMTP_DEV_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_DEV_PORT ?? '1025', 10),
  },
}));
