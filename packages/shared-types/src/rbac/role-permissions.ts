import { Role, ROLE_KEYS, ROLE_META } from './roles';
import { ALL_PERMISSIONS, Permission, PERMISSION_DEFINITIONS, PermissionResource } from './permissions';

/**
 * EXACT Role-Permission mapping defining access rights across Sentinel Vision AI.
 * SINGLE SOURCE OF TRUTH.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: [
    'dashboard:read',
    'cases:read',
    'sightings:read',
    'journeys:read',
    'evidence:read_metadata',
    'evidence:verify',
    'evidence:legal_hold',
    'reports:read',
    'reports:approve',
    'alerts:read',
    'alerts:manage_rules',
    'cameras:read',
    'cameras:view_live',
    'cameras:view_recordings',
    'cameras:manage',
    'topology:edit',
    'users:read',
    'users:manage',
    'users:approve',
    'roles:read',
    'roles:manage',
    'mobile:manage',
    'models:manage',
    'thresholds:propose',
    'thresholds:approve',
    'retention:manage',
    'integrations:manage',
    'apikeys:manage',
    'audit:read',
    'admin:system',
  ] as const,

  investigator: [
    'dashboard:read',
    'cases:read',
    'cases:create',
    'cases:update',
    'cases:assign',
    'cases:close',
    'references:manage',
    'searches:run',
    'searches:cancel',
    'sightings:read',
    'sightings:decide',
    'sightings:decide_critical',
    'journeys:read',
    'evidence:read',
    'evidence:export',
    'evidence:redact',
    'evidence:legal_hold',
    'evidence:verify',
    'reports:read',
    'reports:generate',
    'reports:approve',
    'cameras:read',
    'cameras:view_live',
    'cameras:view_recordings',
    'alerts:read',
    'alerts:act',
    'thresholds:propose',
    'audit:read_own_cases',
    'pii:view_contact',
    'pii:view_medical',
  ] as const,

  reviewer: [
    'dashboard:read',
    'cases:read',
    'sightings:read',
    'sightings:decide',
    'journeys:read',
    'evidence:read',
    'reports:read',
    'cameras:read',
    'cameras:view_live',
    'cameras:view_recordings',
    'alerts:read',
    'alerts:act',
  ] as const,

  viewer: [
    'dashboard:read',
    'cases:read',
    'sightings:read',
    'journeys:read',
    'reports:read',
    'cameras:read',
    'cameras:view_live',
    'cameras:view_recordings',
    'alerts:read',
  ] as const,

  mobile_operator: [
    'mobile:profile',
    'mobile:devices_own',
    'mobile:stream_own',
  ] as const,
};

/**
 * Check if a given role has a specific permission.
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

/**
 * Return all permissions assigned to a given role.
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

/**
 * Generate docs/rbac.md content dynamically from code so code and documentation never drift.
 */
export function generateRbacMarkdown(): string {
  const lines: string[] = [];
  lines.push('# Sentinel Vision AI — Role-Based Access Control (RBAC) Specification');
  lines.push('');
  lines.push('> **Notice:** This document is automatically generated from `packages/shared-types/src/rbac/role-permissions.ts`.');
  lines.push('> Do not manually edit this file. Update the shared types catalog and re-run docs sync.');
  lines.push('');
  lines.push('## 1. System Roles Overview');
  lines.push('');
  lines.push('| Role Key | Display Label | Realm | Landing Route | Session Max | Idle Timeout | Description |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const roleKey of ROLE_KEYS) {
    const meta = ROLE_META[roleKey];
    lines.push(
      `| \`${meta.key}\` | **${meta.label}** | \`${meta.realm}\` | \`${meta.landing}\` | ${meta.maxSessions} | ${meta.idleTimeoutMinutes}m | ${meta.description} |`,
    );
  }
  lines.push('');
  lines.push('## 2. Role-Permission Matrix');
  lines.push('');
  lines.push('Permissions are structured as `resource:action`. A checkmark (✅) denotes authorized capability.');
  lines.push('');
  lines.push('| Resource | Permission | Super Admin | Investigator | Reviewer | Viewer | Mobile Operator | Step-Up? |');
  lines.push('|---|---|:---:|:---:|:---:|:---:|:---:|:---:|');

  const grouped = new Map<PermissionResource, Permission[]>();
  for (const p of ALL_PERMISSIONS) {
    const def = PERMISSION_DEFINITIONS[p];
    if (!grouped.has(def.resource)) {
      grouped.set(def.resource, []);
    }
    grouped.get(def.resource)!.push(p);
  }

  for (const [res, perms] of grouped.entries()) {
    for (const p of perms) {
      const sa = roleHasPermission('super_admin', p) ? '✅' : '—';
      const inv = roleHasPermission('investigator', p) ? '✅' : '—';
      const rev = roleHasPermission('reviewer', p) ? '✅' : '—';
      const vw = roleHasPermission('viewer', p) ? '✅' : '—';
      const mo = roleHasPermission('mobile_operator', p) ? '✅' : '—';
      const stepUp = PERMISSION_DEFINITIONS[p].stepUpRequired ? '🔒 Required' : '—';
      lines.push(`| \`${res}\` | \`${p}\` | ${sa} | ${inv} | ${rev} | ${vw} | ${mo} | ${stepUp} |`);
    }
  }

  lines.push('');
  lines.push('## 3. Strict Separation of Duties (Four-Eyes & Guardrails)');
  lines.push('');
  lines.push('1. **Super Admin Operational Isolation**: Super Admins cannot execute vector searches (`searches:run`), make sighting verification decisions (`sightings:decide`), create cases (`cases:create`), or export evidence (`evidence:export`). This prevents administrative oversight abuse.');
  lines.push('2. **Four-Eyes Verification on Critical Dossiers**: An investigator cannot be the sole decider on an Amber alert / critical case they registered.');
  lines.push('3. **Dual-Admin Super Admin Promotion**: Promoting an account to `super_admin` strictly requires a signed change request and confirmation from a second active Super Admin.');
  lines.push('4. **Dual-Admin Threshold Activation**: Activating live cosine similarity threshold changes in production requires a second administrator approval.');
  lines.push('5. **Report Separation**: An investigator who generated a dossier report cannot be the sole approver (`approver !== generator`).');
  lines.push('6. **Realm Isolation**: Mobile operators (`realm: mobile`) possess strictly scoped ingestion tokens (`aud: mobile`) rejected on all command center console endpoints.');
  lines.push('');
  return lines.join('\n');
}
