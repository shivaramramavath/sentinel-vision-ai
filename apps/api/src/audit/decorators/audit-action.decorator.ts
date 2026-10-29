import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit_metadata';

export interface AuditActionOptions {
  action: string;
  entityType: string;
  extractEntityId?: (req: any, res: any) => string;
}

export const AuditAction = (action: string, entityType: string, extractEntityId?: (req: any, res: any) => string) =>
  SetMetadata(AUDIT_METADATA_KEY, { action, entityType, extractEntityId });
