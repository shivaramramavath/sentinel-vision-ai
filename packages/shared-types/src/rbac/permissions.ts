/**
 * Granular Permissions Catalog for Sentinel Vision AI.
 * Resource:Action string union — SINGLE SOURCE OF TRUTH.
 */

export const ALL_PERMISSIONS = [
  // Dashboard
  'dashboard:read',

  // Cases
  'cases:read',
  'cases:create',
  'cases:update',
  'cases:assign',
  'cases:close',

  // References
  'references:manage',

  // Searches
  'searches:run',
  'searches:cancel',

  // Sightings & Decisions
  'sightings:read',
  'sightings:decide',
  'sightings:decide_critical',

  // Journeys
  'journeys:read',

  // Evidence & Custody
  'evidence:read',
  'evidence:read_metadata',
  'evidence:export',
  'evidence:redact',
  'evidence:legal_hold',
  'evidence:verify',

  // Reports
  'reports:read',
  'reports:generate',
  'reports:approve',

  // Cameras & Topology
  'cameras:read',
  'cameras:view_live',
  'cameras:view_recordings',
  'cameras:manage',
  'topology:edit',

  // Alerts
  'alerts:read',
  'alerts:act',
  'alerts:manage_rules',

  // User Administration
  'users:read',
  'users:manage',
  'users:approve',

  // Roles & RBAC
  'roles:read',
  'roles:manage',

  // Mobile Ingestion & Devices
  'mobile:manage',
  'mobile:profile',
  'mobile:devices_own',
  'mobile:stream_own',

  // Models, Inference & Thresholds
  'models:manage',
  'thresholds:propose',
  'thresholds:approve',

  // Platform Ops & Governance
  'retention:manage',
  'integrations:manage',
  'apikeys:manage',
  'audit:read',
  'audit:read_own_cases',
  'admin:system',

  // PII & Sensitive Fields
  'pii:view_contact',
  'pii:view_medical',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export type PermissionResource =
  | 'dashboard'
  | 'cases'
  | 'references'
  | 'searches'
  | 'sightings'
  | 'journeys'
  | 'evidence'
  | 'reports'
  | 'cameras'
  | 'topology'
  | 'alerts'
  | 'users'
  | 'roles'
  | 'mobile'
  | 'models'
  | 'thresholds'
  | 'retention'
  | 'integrations'
  | 'apikeys'
  | 'audit'
  | 'pii'
  | 'admin';

export interface PermissionDefinition {
  permission: Permission;
  resource: PermissionResource;
  action: string;
  label: string;
  description: string;
  stepUpRequired?: boolean;
}

export const PERMISSION_DEFINITIONS: Record<Permission, PermissionDefinition> = {
  'dashboard:read': {
    permission: 'dashboard:read',
    resource: 'dashboard',
    action: 'read',
    label: 'View Command Center',
    description: 'Access the operational command dashboard overview.',
  },
  'cases:read': {
    permission: 'cases:read',
    resource: 'cases',
    action: 'read',
    label: 'View Cases',
    description: 'View active, pending and archived missing-person cases.',
  },
  'cases:create': {
    permission: 'cases:create',
    resource: 'cases',
    action: 'create',
    label: 'Register New Case',
    description: 'Create and register new missing-person investigations.',
  },
  'cases:update': {
    permission: 'cases:update',
    resource: 'cases',
    action: 'update',
    label: 'Edit Case Dossier',
    description: 'Update case notes, reference sets and metadata.',
  },
  'cases:assign': {
    permission: 'cases:assign',
    resource: 'cases',
    action: 'assign',
    label: 'Assign Case Investigators',
    description: 'Assign or reassign primary case investigators.',
  },
  'cases:close': {
    permission: 'cases:close',
    resource: 'cases',
    action: 'close',
    label: 'Close / Archive Case',
    description: 'Mark cases as resolved, found, or closed.',
  },
  'references:manage': {
    permission: 'references:manage',
    resource: 'references',
    action: 'manage',
    label: 'Manage Reference Photos',
    description: 'Upload, crop, verify quality and set reference photo vectors.',
  },
  'searches:run': {
    permission: 'searches:run',
    resource: 'searches',
    action: 'run',
    label: 'Execute Vector Search',
    description: 'Trigger asynchronous face and Re-ID vector searches across camera feeds.',
  },
  'searches:cancel': {
    permission: 'searches:cancel',
    resource: 'searches',
    action: 'cancel',
    label: 'Cancel Vector Search',
    description: 'Halt active or queued background search jobs.',
  },
  'sightings:read': {
    permission: 'sightings:read',
    resource: 'sightings',
    action: 'read',
    label: 'View Sightings',
    description: 'Browse candidate sighting cards and detection crops.',
  },
  'sightings:decide': {
    permission: 'sightings:decide',
    resource: 'sightings',
    action: 'decide',
    label: 'Decide Sighting Verification',
    description: 'Record human adjudications (possible / same person / not same person).',
  },
  'sightings:decide_critical': {
    permission: 'sightings:decide_critical',
    resource: 'sightings',
    action: 'decide_critical',
    label: 'Adjudicate Critical Sightings',
    description: 'Verify high-stakes / amber alert sightings subject to four-eyes policy.',
  },
  'journeys:read': {
    permission: 'journeys:read',
    resource: 'journeys',
    action: 'read',
    label: 'View Tracking Journeys',
    description: 'Inspect spatiotemporal journey paths and camera hops.',
  },
  'evidence:read': {
    permission: 'evidence:read',
    resource: 'evidence',
    action: 'read',
    label: 'View Evidence Vault',
    description: 'Access digital evidence records, thumbnails and chain of custody.',
  },
  'evidence:read_metadata': {
    permission: 'evidence:read_metadata',
    resource: 'evidence',
    action: 'read_metadata',
    label: 'View Evidence Metadata Only',
    description: 'View evidence custody ledger and SHA-256 hashes without raw asset access.',
  },
  'evidence:export': {
    permission: 'evidence:export',
    resource: 'evidence',
    action: 'export',
    label: 'Export Evidence Package',
    description: 'Generate and download court-ready evidence bundles with custody manifests.',
    stepUpRequired: true,
  },
  'evidence:redact': {
    permission: 'evidence:redact',
    resource: 'evidence',
    action: 'redact',
    label: 'Redact Evidence Asset',
    description: 'Apply irreversible privacy blurring and redacted bounding boxes.',
  },
  'evidence:legal_hold': {
    permission: 'evidence:legal_hold',
    resource: 'evidence',
    action: 'legal_hold',
    label: 'Apply / Lift Legal Hold',
    description: 'Freeze evidence assets from statutory retention purges.',
    stepUpRequired: true,
  },
  'evidence:verify': {
    permission: 'evidence:verify',
    resource: 'evidence',
    action: 'verify',
    label: 'Verify Custody Integrity',
    description: 'Perform cryptographic ledger audits and hash verification.',
  },
  'reports:read': {
    permission: 'reports:read',
    resource: 'reports',
    action: 'read',
    label: 'View Reports',
    description: 'Browse generated intelligence and case closure reports.',
  },
  'reports:generate': {
    permission: 'reports:generate',
    resource: 'reports',
    action: 'generate',
    label: 'Generate Reports',
    description: 'Compile new investigation dossier reports.',
  },
  'reports:approve': {
    permission: 'reports:approve',
    resource: 'reports',
    action: 'approve',
    label: 'Approve Reports',
    description: 'Formally sign off on generated reports (enforces four-eyes approval).',
  },
  'cameras:read': {
    permission: 'cameras:read',
    resource: 'cameras',
    action: 'read',
    label: 'View Camera List',
    description: 'Browse camera registry and operational health indicators.',
  },
  'cameras:view_live': {
    permission: 'cameras:view_live',
    resource: 'cameras',
    action: 'view_live',
    label: 'View Live Feeds',
    description: 'Stream live WebRTC / RTSP feeds from surveillance nodes.',
  },
  'cameras:view_recordings': {
    permission: 'cameras:view_recordings',
    resource: 'cameras',
    action: 'view_recordings',
    label: 'View DVR Playback',
    description: 'Access historical camera recording segments.',
  },
  'cameras:manage': {
    permission: 'cameras:manage',
    resource: 'cameras',
    action: 'manage',
    label: 'Manage Surveillance Cameras',
    description: 'Register, configure RTSP streams, and decommission cameras.',
  },
  'topology:edit': {
    permission: 'topology:edit',
    resource: 'topology',
    action: 'edit',
    label: 'Edit Spatial Topology',
    description: 'Position cameras, adjust field-of-view cones and configure transition edges.',
  },
  'alerts:read': {
    permission: 'alerts:read',
    resource: 'alerts',
    action: 'read',
    label: 'View Alerts Inbox',
    description: 'Read system and operational alerts.',
  },
  'alerts:act': {
    permission: 'alerts:act',
    resource: 'alerts',
    action: 'act',
    label: 'Acknowledge / Resolve Alerts',
    description: 'Triage, assign and resolve triggered system alerts.',
  },
  'alerts:manage_rules': {
    permission: 'alerts:manage_rules',
    resource: 'alerts',
    action: 'manage_rules',
    label: 'Configure Alert Rules',
    description: 'Define alert routing channels, notification thresholds and on-call rosters.',
  },
  'users:read': {
    permission: 'users:read',
    resource: 'users',
    action: 'read',
    label: 'View User Accounts',
    description: 'View agency staff roster, badge assignments and activity status.',
  },
  'users:manage': {
    permission: 'users:manage',
    resource: 'users',
    action: 'manage',
    label: 'Manage User Accounts',
    description: 'Invite users, suspend accounts, and reset credentials.',
    stepUpRequired: true,
  },
  'users:approve': {
    permission: 'users:approve',
    resource: 'users',
    action: 'approve',
    label: 'Approve User Clearance',
    description: 'Approve pending registration requests for operational access.',
  },
  'roles:read': {
    permission: 'roles:read',
    resource: 'roles',
    action: 'read',
    label: 'View RBAC Permissions',
    description: 'Inspect role permission matrices and authorization policies.',
  },
  'roles:manage': {
    permission: 'roles:manage',
    resource: 'roles',
    action: 'manage',
    label: 'Assign & Reassign Roles',
    description: 'Modify user roles (super_admin grants strictly require dual-admin authorization).',
    stepUpRequired: true,
  },
  'mobile:manage': {
    permission: 'mobile:manage',
    resource: 'mobile',
    action: 'manage',
    label: 'Manage Mobile Fleet',
    description: 'Approve mobile capture devices and pair field operators.',
  },
  'mobile:profile': {
    permission: 'mobile:profile',
    resource: 'mobile',
    action: 'profile',
    label: 'Manage Own Mobile Profile',
    description: 'Field operator self-management of assigned device credentials.',
  },
  'mobile:devices_own': {
    permission: 'mobile:devices_own',
    resource: 'mobile',
    action: 'devices_own',
    label: 'Register Own Mobile Device',
    description: 'Register and pair mobile devices belonging to the authenticated operator.',
  },
  'mobile:stream_own': {
    permission: 'mobile:stream_own',
    resource: 'mobile',
    action: 'stream_own',
    label: 'Publish Own Mobile Stream',
    description: 'Publish live camera video stream from authorized mobile device.',
  },
  'models:manage': {
    permission: 'models:manage',
    resource: 'models',
    action: 'manage',
    label: 'Manage AI Model Registry',
    description: 'Shadow-deploy, benchmark and promote vector embedding models.',
  },
  'thresholds:propose': {
    permission: 'thresholds:propose',
    resource: 'thresholds',
    action: 'propose',
    label: 'Propose Similarity Thresholds',
    description: 'Adjust and simulate proposed facial & Re-ID cosine distance thresholds.',
  },
  'thresholds:approve': {
    permission: 'thresholds:approve',
    resource: 'thresholds',
    action: 'approve',
    label: 'Activate Matching Thresholds',
    description: 'Formally activate live production thresholds (enforces four-eyes dual admin).',
    stepUpRequired: true,
  },
  'retention:manage': {
    permission: 'retention:manage',
    resource: 'retention',
    action: 'manage',
    label: 'Manage Data Retention',
    description: 'Configure and execute statutory data retention purge policies.',
    stepUpRequired: true,
  },
  'integrations:manage': {
    permission: 'integrations:manage',
    resource: 'integrations',
    action: 'manage',
    label: 'Manage Integrations',
    description: 'Configure webhooks, CAD/RMS connectors and message dispatchers.',
  },
  'apikeys:manage': {
    permission: 'apikeys:manage',
    resource: 'apikeys',
    action: 'manage',
    label: 'Manage API Keys',
    description: 'Mint and revoke machine-to-machine integration API keys.',
    stepUpRequired: true,
  },
  'audit:read': {
    permission: 'audit:read',
    resource: 'audit',
    action: 'read',
    label: 'View Global Audit Logs',
    description: 'Inspect immutable CJIS audit trails across all agency operations.',
  },
  'audit:read_own_cases': {
    permission: 'audit:read_own_cases',
    resource: 'audit',
    action: 'read_own_cases',
    label: 'View Own Case Audit Trails',
    description: 'Inspect audit trail records associated with assigned cases.',
  },
  'pii:view_contact': {
    permission: 'pii:view_contact',
    resource: 'pii',
    action: 'view_contact',
    label: 'View Contact PII',
    description: 'Access unmasked reporter phone numbers, family contacts and home addresses.',
  },
  'pii:view_medical': {
    permission: 'pii:view_medical',
    resource: 'pii',
    action: 'view_medical',
    label: 'View Medical PII',
    description: 'Access confidential medical conditions, cognitive impairments and prescription data.',
  },
  'admin:system': {
    permission: 'admin:system',
    resource: 'admin',
    action: 'system',
    label: 'System Administration',
    description: 'Full platform administration panel access.',
  },
};

/**
 * Check if a permission requires step-up re-authentication.
 */
export function isStepUpPermission(permission: Permission): boolean {
  return Boolean(PERMISSION_DEFINITIONS[permission]?.stepUpRequired);
}
