import { z } from 'zod';
import { AlertStatus } from '../enums';

export const CreateAlertSchema = z.object({
  caseId: z.string(),
  sightingId: z.string(),
  message: z.string().max(2000),
  webhookUrl: z.string().url().optional(),
  recipientEmail: z.string().email().optional(),
});

export const AlertSchema = CreateAlertSchema.extend({
  id: z.string(),
  status: z.nativeEnum(AlertStatus).default(AlertStatus.PENDING),
  attempts: z.number().int().min(0).default(0),
  lastAttemptAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.coerce.date(),
});

export type CreateAlertDto = z.infer<typeof CreateAlertSchema>;
export type Alert = z.infer<typeof AlertSchema>;
