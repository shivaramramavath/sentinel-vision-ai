import { Permission } from '@sentinel/shared-types';
import {
  Users,
  Shield,
  Smartphone,
  Cpu,
  Sliders,
  Layers,
  Plug,
  Clock,
  History,
  Key,
  Activity,
  type LucideIcon,
} from 'lucide-react';

export interface AdminSectionConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  permissions: Permission[];
}

export const ADMIN_SECTIONS: AdminSectionConfig[] = [
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    desc: 'Personnel records, RBAC roles, MFA enforcement & active sessions',
    permissions: ['users:read'],
  },
  {
    id: 'roles',
    label: 'Roles & RBAC',
    icon: Shield,
    desc: 'Resource permissions matrix, scoping & access reviews',
    permissions: ['roles:read'],
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: Users,
    desc: 'Investigation units, on-call rotations & site assignments',
    permissions: ['users:read'],
  },
  {
    id: 'mobile-operators',
    label: 'Mobile Operators',
    icon: Smartphone,
    desc: 'Self-registered phone operators, device approvals & WebRTC streams',
    permissions: ['mobile:manage'],
  },
  {
    id: 'models',
    label: 'AI Models',
    icon: Cpu,
    desc: 'Face ArcFace, Re-ID OSNet, YOLOv8 detectors & shadow evaluation',
    permissions: ['models:manage'],
  },
  {
    id: 'thresholds',
    label: 'Thresholds & SLA',
    icon: Sliders,
    desc: 'Calibrated similarity bands, SLA limits & impact simulation',
    permissions: ['thresholds:propose', 'thresholds:approve'],
  },
  {
    id: 'queues',
    label: 'Queues & Pipeline',
    icon: Layers,
    desc: 'BullMQ queue depths, Kafka topic lag & DLQ replay tools',
    permissions: ['admin:system'],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    desc: 'Pinecone, MediaMTX, MinIO, Redis, Kafka & write-only credentials',
    permissions: ['integrations:manage'],
  },
  {
    id: 'retention',
    label: 'Retention & Privacy',
    icon: Clock,
    desc: 'CJIS/GDPR auto-pruning rules, legal holds & deletion previews',
    permissions: ['retention:manage'],
  },
  {
    id: 'audit',
    label: 'Audit Log',
    icon: History,
    desc: 'Immutable searchable ledger of all operator & configuration changes',
    permissions: ['audit:read'],
  },
  {
    id: 'api',
    label: 'API Keys & Webhooks',
    icon: Key,
    desc: 'Scoped bearer tokens, webhook endpoints & delivery logs',
    permissions: ['apikeys:manage'],
  },
  {
    id: 'health',
    label: 'System Health',
    icon: Activity,
    desc: 'Target of top bar status chip — microservices status & p95 latencies',
    permissions: ['admin:system'],
  },
];

export function canAccessSection(
  section: AdminSectionConfig,
  can: (p: Permission) => boolean,
): boolean {
  return section.permissions.some((p) => can(p));
}

export function firstAccessibleSection(
  can: (p: Permission) => boolean,
): string | null {
  for (const section of ADMIN_SECTIONS) {
    if (canAccessSection(section, can)) {
      return section.id;
    }
  }
  return null;
}

export function hasAnyAdminPermission(
  can: (p: Permission) => boolean,
): boolean {
  return firstAccessibleSection(can) !== null;
}
