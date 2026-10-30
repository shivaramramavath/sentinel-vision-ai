'use client';

import React, { use, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Lock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Fingerprint,
  Radio,
  Share2,
  X,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/hooks/use-permission';
import {
  ADMIN_SECTIONS,
  canAccessSection,
  firstAccessibleSection,
} from '@/config/admin-sections';
import type {
  AdminUserRecord,
  RbacPermissionMatrix,
  InvestigationTeam,
  RegisteredAiModel,
  ThresholdProfile,
  ImpactPreviewResult,
  QueueLagTelemetry,
  RetentionPolicy,
  AdminAuditEntry,
  ServiceHealthStatus,
  Role,
} from '@sentinel/shared-types';
import { ROLE_META, ROLE_PERMISSIONS, ROLE_KEYS, roleLabel } from '@sentinel/shared-types';

export default function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const router = useRouter();
  const { section } = use(params);
  const { can, role, roleMeta, status } = usePermission();

  const activeSection = ADMIN_SECTIONS.find((s) => s.id === section);
  if (!activeSection) {
    notFound();
  }

  // Common Change Reason Modal State (Required for every configuration edit)
  const [changeReasonModal, setChangeReasonModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    requiresSecondAdmin: boolean;
    onConfirm: (reason: string, secondAdminEmail?: string) => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    requiresSecondAdmin: false,
    onConfirm: async () => {},
  });
  const [changeReasonText, setChangeReasonText] = useState<string>('');
  const [secondAdminEmailText, setSecondAdminEmailText] = useState<string>('');
  const [isSubmittingChange, setIsSubmittingChange] = useState<boolean>(false);

  // Users Queries & State
  const { data: users = [], refetch: refetchUsers } = useQuery<AdminUserRecord[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => adminService.getUsers(),
    enabled: status === 'success' && section === 'users' && can('users:read'),
  });
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<string>('Reviewer');
  const [inviteDept, setInviteDept] = useState<string>('Surveillance Triage');
  const [roleChangeUser, setRoleChangeUser] = useState<AdminUserRecord | null>(null);
  const [targetNewRole, setTargetNewRole] = useState<'Super Admin' | 'Investigator' | 'Reviewer' | 'Viewer'>('Investigator');
  const [simulatorRole, setSimulatorRole] = useState<Role | 'all'>('all');

  // Roles Queries
  const { data: roles = [] } = useQuery<RbacPermissionMatrix[]>({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.getRoles(),
    enabled: status === 'success' && section === 'roles' && can('roles:read'),
  });

  // Teams Queries
  const { data: teams = [] } = useQuery<InvestigationTeam[]>({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminService.getTeams(),
    enabled: status === 'success' && section === 'teams' && can('users:read'),
  });

  // Models Queries
  const { data: models = [], refetch: refetchModels } = useQuery<RegisteredAiModel[]>({
    queryKey: ['admin', 'models'],
    queryFn: () => adminService.getModels(),
    enabled: status === 'success' && section === 'models' && can('models:manage'),
  });

  // Thresholds Queries & State
  const { data: thresholds = [], refetch: refetchThresholds } = useQuery<ThresholdProfile[]>({
    queryKey: ['admin', 'thresholds'],
    queryFn: () => adminService.getThresholds(),
    enabled: status === 'success' && section === 'thresholds' && (can('thresholds:propose') || can('thresholds:approve')),
  });
  const [impactPreviewResult, setImpactPreviewResult] = useState<ImpactPreviewResult | null>(null);

  // Queues Queries
  const { data: queues = [] } = useQuery<QueueLagTelemetry[]>({
    queryKey: ['admin', 'queues'],
    queryFn: () => adminService.getQueues(),
    enabled: status === 'success' && section === 'queues' && can('admin:system'),
  });

  // Integrations Queries
  const { data: integrations = {} } = useQuery<Record<string, any>>({
    queryKey: ['admin', 'integrations'],
    queryFn: () => adminService.getIntegrations(),
    enabled: status === 'success' && section === 'integrations' && can('integrations:manage'),
  });

  // Retention Queries & State
  const { data: retentionPolicies = [] } = useQuery<RetentionPolicy[]>({
    queryKey: ['admin', 'retention'],
    queryFn: () => adminService.getRetention(),
    enabled: status === 'success' && section === 'retention' && can('retention:manage'),
  });
  const [deletionPreview, setDeletionPreview] = useState<any | null>(null);

  // Audit Queries
  const { data: auditLogs = [] } = useQuery<AdminAuditEntry[]>({
    queryKey: ['admin', 'audit'],
    queryFn: () => adminService.getAuditLog(),
    enabled: status === 'success' && section === 'audit' && can('audit:read'),
  });

  // System Health Queries
  const { data: healthStatuses = [] } = useQuery<ServiceHealthStatus[]>({
    queryKey: ['admin', 'health'],
    queryFn: () => adminService.getSystemHealth(),
    enabled: status === 'success' && section === 'health' && can('admin:system'),
  });

  const handleOpenChangeModal = (
    title: string,
    description: string,
    requiresSecondAdmin: boolean,
    onConfirm: (reason: string, secondAdminEmail?: string) => Promise<void>,
  ) => {
    setChangeReasonModal({
      open: true,
      title,
      description,
      requiresSecondAdmin,
      onConfirm,
    });
    setChangeReasonText('');
    setSecondAdminEmailText('');
  };

  const handleConfirmChangeModal = async () => {
    if (!changeReasonText.trim()) return;
    setIsSubmittingChange(true);
    try {
      await changeReasonModal.onConfirm(changeReasonText, secondAdminEmailText);
      setChangeReasonModal((prev) => ({ ...prev, open: false }));
    } finally {
      setIsSubmittingChange(false);
    }
  };

  const hasAccess = canAccessSection(activeSection, can);
  const firstAccessible = firstAccessibleSection(can);

  if (status === 'loading') {
    return (
      <div className="space-y-4 pb-8">
        <div className="flex items-center justify-between border-b pb-3 pt-1">
          <div className="space-y-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-60 min-w-[220px] space-y-2 hidden md:block">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-8 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success' && !hasAccess) {
    return (
      <div className="space-y-4 pb-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3 pt-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Administration
            </h1>
            <p className="text-xs text-muted-foreground">
              System configuration, biometric models, operator devices &amp; audit policies
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-emerald-500 border-emerald-500/40 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse" />
              {roleLabel(role)}
            </Badge>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-6">
          <nav
            aria-label="Admin Sections"
            className="hidden md:block w-60 min-w-[220px] shrink-0 space-y-1 sticky top-16 h-fit"
          >
            {ADMIN_SECTIONS.filter((s) => canAccessSection(s, can)).map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.id}
                  href={`/admin/${s.id}`}
                  title={s.label}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </Link>
              );
            })}
          </nav>

          <main className="flex-1 min-w-0">
            <Card className="border-destructive/30 bg-destructive/5 text-center p-8 max-w-lg mx-auto my-8">
              <CardHeader className="items-center pb-2">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                  <ShieldAlert className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="text-lg font-bold">Access Denied (403)</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  You do not have permission to access the "{activeSection.label}" administration section with role {roleLabel(role)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
                {firstAccessible && (
                  <Button asChild size="sm" variant="default" className="text-xs w-full sm:w-auto">
                    <Link href={`/admin/${firstAccessible}`}>
                      Go to accessible section
                    </Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="text-xs w-full sm:w-auto">
                  <Link href={roleMeta.landing || '/dashboard'}>
                    Return to Operational Portal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3 pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Administration
          </h1>
          <p className="text-xs text-muted-foreground">
            System configuration, biometric models, operator devices &amp; audit policies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-emerald-500 border-emerald-500/40 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse" />
            {roleLabel(role)}
          </Badge>
        </div>
      </header>

      {/* Mobile Sub-Navigation Select */}
      <div className="block md:hidden">
        <label className="text-[11px] font-mono text-muted-foreground uppercase">Section:</label>
        <select
          value={section}
          onChange={(e) => router.push(`/admin/${e.target.value}`)}
          className="mt-1 w-full rounded-md border bg-card p-2 text-xs font-mono text-foreground focus:outline-none"
        >
          {ADMIN_SECTIONS.filter((s) => canAccessSection(s, can)).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Admin Grid Layout: Left Nav + Right Content Pane */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sub-Navigation (Sticky) */}
        <nav
          aria-label="Admin Sections"
          className="hidden md:block w-60 min-w-[220px] shrink-0 space-y-1 sticky top-16 h-fit"
        >
          {ADMIN_SECTIONS.filter((s) => canAccessSection(s, can)).map((s) => {
            const Icon = s.icon;
            const isActive = s.id === section;

            return (
              <Link
                key={s.id}
                href={`/admin/${s.id}`}
                title={s.label}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-foreground text-background font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{s.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Section Content */}
        <main className="flex-1 min-w-0 space-y-4">
          <div className="border-b pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {activeSection.label}
              </h2>
              <p className="text-xs text-muted-foreground">{activeSection.desc}</p>
            </div>
          </div>

          {/* ================= SECTION: USERS ================= */}
          {section === 'users' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="p-4 border-b bg-card flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">User Accounts &amp; Access Controls</CardTitle>
                    <p className="text-xs text-muted-foreground">Managed personnel and active sessions</p>
                  </div>
                  <Button size="sm" className="h-8 gap-1.5 text-xs font-medium" onClick={() => setShowInviteModal(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Invite User</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60 text-xs">
                    {users.map((u) => (
                      <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-xs">{u.fullName}</span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {u.badgeNumber}
                            </Badge>
                            <Badge
                              variant={u.role === 'Super Admin' ? 'default' : 'secondary'}
                              className="font-mono text-[10px]"
                            >
                              {u.role}
                            </Badge>
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {u.email} · {u.department} · {u.activeSessionsCount} active sessions
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono"
                            onClick={() => {
                              setRoleChangeUser(u);
                              setTargetNewRole(u.role === 'Investigator' ? 'Reviewer' : 'Investigator');
                            }}
                          >
                            Change Role
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs font-mono"
                            onClick={() => {
                              handleOpenChangeModal(
                                `Reset MFA for ${u.fullName}`,
                                `This will invalidate current 2FA authenticator tokens and force re-enrollment on next login.`,
                                false,
                                async (reason) => {
                                  await adminService.resetMfa(u.id, reason);
                                  refetchUsers();
                                },
                              );
                            }}
                          >
                            Reset MFA
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs font-mono text-destructive hover:text-destructive"
                            onClick={() => {
                              handleOpenChangeModal(
                                `Revoke Sessions for ${u.fullName}`,
                                `This will immediately terminate all active web and mobile device sessions.`,
                                false,
                                async (reason) => {
                                  await adminService.revokeSessions(u.id, reason);
                                  refetchUsers();
                                },
                              );
                            }}
                          >
                            Logout
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Auth Policy */}
              <Card>
                <CardHeader className="p-4 border-b bg-card">
                  <CardTitle className="text-sm font-semibold">Security &amp; Authentication Policy</CardTitle>
                  <p className="text-xs text-muted-foreground">Mandatory identity invariants enforced across all clients</p>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 border rounded-lg">
                    <div>
                      <span className="font-semibold text-foreground">Enforce Multi-Factor Authentication (MFA)</span>
                      <p className="text-[11px] text-muted-foreground">Requires TOTP or SMS verification on every login</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-2.5 border rounded-lg">
                    <div>
                      <span className="font-semibold text-foreground">Session Inactivity Timeout</span>
                      <p className="text-[11px] text-muted-foreground">Terminates background sessions after 30 minutes of idle time</p>
                    </div>
                    <span className="font-mono font-semibold">30 min</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================= SECTION: ROLES ================= */}
          {section === 'roles' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Role Simulator &amp; Permissions Preview</h3>
                  <p className="text-xs text-muted-foreground">Select a role to preview active capabilities, landing page and timeouts</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">View as:</span>
                  <select
                    value={simulatorRole}
                    onChange={(e) => setSimulatorRole(e.target.value as any)}
                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">All Roles (Matrix View)</option>
                    {ROLE_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {ROLE_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {simulatorRole !== 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Landing Page</span>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">{ROLE_META[simulatorRole].landing}</p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Realm</span>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1 uppercase">{ROLE_META[simulatorRole].realm}</p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">MFA Policy</span>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1 uppercase">{ROLE_META[simulatorRole].mfaPolicy}</p>
                  </Card>
                  <Card className="p-4">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground">Idle Timeout</span>
                    <p className="font-mono text-sm font-semibold text-foreground mt-1">{ROLE_META[simulatorRole].idleTimeoutMinutes} min</p>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader className="p-4 border-b bg-card">
                  <CardTitle className="text-sm font-semibold">Canonical RBAC Permissions Matrix</CardTitle>
                  <p className="text-xs text-muted-foreground">Single Source of Truth defined in @sentinel/shared-types across 46 resource actions</p>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-muted/40 border-b text-[10px] uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3">Canonical Role</th>
                        <th className="p-3">Realm</th>
                        <th className="p-3">Allowed Permissions</th>
                        <th className="p-3">Max Sessions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {ROLE_KEYS.filter((k) => simulatorRole === 'all' || simulatorRole === k).map((roleKey) => {
                        const meta = ROLE_META[roleKey];
                        const perms = ROLE_PERMISSIONS[roleKey];
                        return (
                          <tr key={roleKey} className="hover:bg-muted/20">
                            <td className="p-3 font-semibold text-foreground">
                              <div>{meta.label}</div>
                              <span className="text-[10px] font-mono text-muted-foreground">({roleKey})</span>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {meta.realm}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1 max-w-2xl">
                                {perms.map((p) => (
                                  <span
                                    key={p}
                                    className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono text-foreground border border-border/40"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-foreground">{meta.maxSessions}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================= SECTION: TEAMS ================= */}
          {section === 'teams' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((t) => (
                <Card key={t.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{t.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {t.memberCount} officers
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.department}</p>
                  <div className="text-[11px] font-mono text-muted-foreground pt-1">
                    Commander: <strong className="text-foreground">{t.leadOfficerName}</strong> · Assigned Sites: {t.assignedSiteIds.join(', ')}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ================= SECTION: MOBILE OPERATORS ================= */}
          {section === 'mobile-operators' && (
            <Card>
              <CardHeader className="p-4 border-b bg-card">
                <CardTitle className="text-sm font-semibold">Mobile Operator Fleet &amp; Streaming Approvals</CardTitle>
                <p className="text-xs text-muted-foreground">Self-registered field phone devices streaming directly to MediaMTX</p>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                {[
                  { operator: 'Officer J. Blake', device: 'Pixel 8 Pro (Chrome)', status: 'Approved', camera: 'CAM-MOB-01', stream: 'Active 28 fps' },
                  { operator: 'Officer K. Chen', device: 'iPhone 15 (Safari)', status: 'Approved', camera: 'CAM-MOB-02', stream: 'Idle' },
                  { operator: 'Reserve Officer S. Vance', device: 'Galaxy S24 (Chrome)', status: 'Pending Approval', camera: 'Unassigned', stream: 'Offline' },
                ].map((d, i) => (
                  <div key={i} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{d.operator}</div>
                      <div className="text-[11px] text-muted-foreground">{d.device} · {d.camera}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.status === 'Approved' ? 'outline' : 'secondary'} className="text-[10px]">
                        {d.status}
                      </Badge>
                      {d.status === 'Pending Approval' && (
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2 font-mono"
                          onClick={() => {
                            handleOpenChangeModal(
                              `Approve Mobile Streaming Device for ${d.operator}`,
                              `This binds the device key to an ingestion camera record and authorizes field WebRTC publishing.`,
                              false,
                              async () => alert(`Approved ${d.operator}`),
                            );
                          }}
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ================= SECTION: AI MODELS ================= */}
          {section === 'models' && (
            <Card>
              <CardHeader className="p-4 border-b bg-card flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Biometric Model Registry &amp; Benchmarks</CardTitle>
                  <p className="text-xs text-muted-foreground">Separate index dimensions strictly enforced by model architecture</p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60 text-xs">
                  {models.map((mod) => (
                    <div key={mod.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">{mod.modelName}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {mod.version}
                          </Badge>
                          <Badge
                            variant={mod.status === 'active' ? 'default' : mod.status === 'shadow' ? 'secondary' : 'outline'}
                            className="font-mono text-[9px] uppercase"
                          >
                            {mod.status}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          Type: {mod.modelType.replace(/_/g, ' ')} · Dimensions: {mod.embeddingDimensions || 'N/A'} · Latency: {mod.benchmarkMetrics.latencyMs}ms
                        </div>
                        <div className="text-[10px] font-mono text-emerald-500">
                          Rank-1 Accuracy: {mod.benchmarkMetrics.rank1Accuracy}% · mAP: {mod.benchmarkMetrics.mAP}% · FMR: {mod.benchmarkMetrics.falseMatchRateAtOperatingPoint}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {mod.status !== 'active' && (
                          <Button
                            size="sm"
                            className="h-7 text-xs font-mono font-medium"
                            onClick={() => {
                              handleOpenChangeModal(
                                `Promote ${mod.modelName} to Production`,
                                `Promoting this model will switch the active inference worker and trigger background re-indexing of reference vectors.`,
                                false,
                                async (reason) => {
                                  await adminService.promoteModel(mod.id, reason);
                                  refetchModels();
                                },
                              );
                            }}
                          >
                            Promote to Active
                          </Button>
                        )}
                        {mod.status === 'candidate' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono"
                            onClick={() => {
                              handleOpenChangeModal(
                                `Deploy ${mod.modelName} in Shadow Mode`,
                                `Runs in parallel with active model to log disagreements without impacting decisions.`,
                                false,
                                async (reason) => {
                                  await adminService.setShadowModel(mod.id, reason);
                                  refetchModels();
                                },
                              );
                            }}
                          >
                            Set Shadow
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ================= SECTION: THRESHOLDS ================= */}
          {section === 'thresholds' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="p-4 border-b bg-card">
                  <CardTitle className="text-sm font-semibold">Similarity Cutoff Profiles</CardTitle>
                  <p className="text-xs text-muted-foreground">Calibrated face, Re-ID, and fused similarity confidence bands</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60 text-xs">
                    {thresholds.map((t) => (
                      <div key={t.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">{t.name}</span>
                            {t.isActive && (
                              <Badge variant="outline" className="font-mono text-emerald-500 border-emerald-500 text-[9px]">
                                ACTIVE PRODUCTION
                              </Badge>
                            )}
                            <Badge variant="secondary" className="font-mono text-[9px]">
                              v{t.version}
                            </Badge>
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            Face High: {t.faceCosineThresholdHigh} · Re-ID High: {t.reidCosineThresholdHigh} · Fused High Band: {t.fusedScoreHighBand}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono"
                            onClick={async () => {
                              const res = await adminService.previewImpact(t.id);
                              setImpactPreviewResult(res);
                            }}
                          >
                            Simulate Impact
                          </Button>

                          {!t.isActive && (
                            <Button
                              size="sm"
                              className="h-7 text-xs font-mono font-medium"
                              onClick={() => {
                                handleOpenChangeModal(
                                  `Activate Profile: ${t.name}`,
                                  `Activating a production threshold profile modifies candidate ranking across live surveillance feeds. Requires second admin signoff.`,
                                  true,
                                  async (reason, secondAdmin) => {
                                    await adminService.activateThreshold(t.id, reason, secondAdmin);
                                    refetchThresholds();
                                  },
                                );
                              }}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Impact Preview Result */}
              {impactPreviewResult && (
                <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 text-xs font-mono space-y-2">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Impact Simulation across last 154 reviewed sightings:</span>
                    <button onClick={() => setImpactPreviewResult(null)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
                    <div>Decisions Flipped: <strong>{impactPreviewResult.decisionsFlippedCount}</strong></div>
                    <div>Extra Reviews / Day: <strong>+{impactPreviewResult.expectedExtraReviewsPerDay}</strong></div>
                    <div>Projected FMR: <strong>{impactPreviewResult.projectedFMR}</strong></div>
                    <div>Projected FNMR: <strong>{impactPreviewResult.projectedFNMR}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION: QUEUES ================= */}
          {section === 'queues' && (
            <Card>
              <CardHeader className="p-4 border-b bg-card">
                <CardTitle className="text-sm font-semibold">Kafka Topic Lag &amp; BullMQ Queue Telemetry</CardTitle>
                <p className="text-xs text-muted-foreground">Real-time consumer backlog and dead-letter queue (DLQ) controls</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60 text-xs font-mono">
                  {queues.map((q, i) => (
                    <div key={i} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground text-xs">{q.queueName}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Active: {q.activeCount} · Waiting: {q.waitingCount} · Consumer Lag: {q.consumerLag}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-foreground">{q.throughputPerSecond} msg/s</div>
                        <div className="text-[10px] text-muted-foreground">DLQ: {q.dlqCount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ================= SECTION: INTEGRATIONS ================= */}
          {section === 'integrations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(integrations).map(([key, val]: [string, any]) => (
                <Card key={key} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground uppercase font-mono">{key}</span>
                    <Badge variant="outline" className="font-mono text-emerald-500 text-[10px]">
                      {val.status?.toUpperCase() || 'CONNECTED'}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground space-y-0.5">
                    {val.indexName && <div>Index: {val.indexName} ({val.dimension}-d)</div>}
                    {val.brokers && <div>Brokers: {val.brokers.join(', ')}</div>}
                    {val.rtspEndpoint && <div>RTSP: {val.rtspEndpoint}</div>}
                    {val.database && <div>Database: {val.database}</div>}
                    {val.latencyMs && <div>Round-trip Latency: {val.latencyMs} ms</div>}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* ================= SECTION: RETENTION ================= */}
          {section === 'retention' && (
            <Card>
              <CardHeader className="p-4 border-b bg-card">
                <CardTitle className="text-sm font-semibold">Data Retention &amp; Privacy Scrubbing Policies</CardTitle>
                <p className="text-xs text-muted-foreground">Automated purging schedules per data classification (CJIS/GDPR compliant)</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60 text-xs font-mono">
                  {retentionPolicies.map((p, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground capitalize">{p.dataClass.replace(/_/g, ' ')}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Purge after {p.retentionDays} days · {p.excludedLegalHoldsCount} items protected by legal hold
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={async () => {
                            const res = await adminService.previewRetentionDeletion(p.dataClass, p.retentionDays);
                            setDeletionPreview(res);
                          }}
                        >
                          Preview Purge
                        </Button>
                        <Switch defaultChecked={p.autoPurgeEnabled} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ================= SECTION: AUDIT LOG ================= */}
          {section === 'audit' && (
            <Card>
              <CardHeader className="p-4 border-b bg-card">
                <CardTitle className="text-sm font-semibold">Global Administrative Audit Log</CardTitle>
                <p className="text-xs text-muted-foreground">Immutable record of all configuration modifications and access events</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60 text-xs font-mono">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{log.action}</span>
                          <Badge variant={log.isAnomaly ? 'destructive' : 'secondary'} className="text-[9px]">
                            {log.targetEntity}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{log.changeReason}</p>
                      <div className="text-[10px] text-muted-foreground/80">
                        Actor: {log.actorEmail} ({log.actorRole}) · IP: {log.ipAddress}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ================= SECTION: SYSTEM HEALTH ================= */}
          {section === 'health' && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="p-4 border-b bg-card flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">System Infrastructure &amp; Microservices Health</CardTitle>
                    <p className="text-xs text-muted-foreground">Live health checks for all Sentinel Vision AI microservices</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-emerald-500 border-emerald-500 text-xs">
                    All Services Healthy
                  </Badge>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {healthStatuses.map((srv, idx) => (
                      <div key={idx} className="p-3 border rounded-xl bg-card space-y-1.5 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">{srv.serviceName}</span>
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Port {srv.port}</span>
                          <span className="text-emerald-500 font-semibold">{srv.latencyMs} ms</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          p95 Latency: {srv.p95LatencyMs}ms · Error: {srv.errorRatePct}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* API Keys & Webhooks */}
          {section === 'api' && (
            <Card>
              <CardHeader className="p-4 border-b bg-card">
                <CardTitle className="text-sm font-semibold">Scoped API Keys &amp; Webhook Endpoints</CardTitle>
                <p className="text-xs text-muted-foreground">Bearer tokens and event subscription endpoints</p>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                <div className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold">CAD Dispatch Integration Key</div>
                    <div className="text-[11px] text-muted-foreground">Scope: sightings:read, alerts:subscribe · Expires: in 90 days</div>
                  </div>
                  <Badge variant="outline" className="text-emerald-500 text-[10px]">ACTIVE</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* ================= MANDATORY CHANGE REASON DIALOG ================= */}
      <Dialog open={changeReasonModal.open} onOpenChange={(open) => setChangeReasonModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{changeReasonModal.title}</DialogTitle>
            <DialogDescription className="text-xs">{changeReasonModal.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-medium text-foreground">
                Required Change Justification / Audit Reason: <span className="text-destructive">*</span>
              </label>
              <Input
                value={changeReasonText}
                onChange={(e) => setChangeReasonText(e.target.value)}
                placeholder="e.g. Approved by incident commander for operational escalation"
                className="h-8 text-xs font-mono"
              />
            </div>

            {changeReasonModal.requiresSecondAdmin && (
              <div className="space-y-1">
                <label className="font-medium text-foreground">
                  Second Administrator Approval Email: <span className="text-destructive">*</span>
                </label>
                <Input
                  value={secondAdminEmailText}
                  onChange={(e) => setSecondAdminEmailText(e.target.value)}
                  placeholder="admin2@sentinel.local"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setChangeReasonModal((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmChangeModal}
              disabled={isSubmittingChange || !changeReasonText.trim()}
            >
              {isSubmittingChange ? 'Saving Audit Entry...' : 'Confirm & Apply Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= INVITE USER DIALOG ================= */}
      {showInviteModal && (
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Invite New Personnel</DialogTitle>
              <DialogDescription className="text-xs">
                Send onboarding credentials with RBAC assignment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-medium">Email Address:</label>
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="officer@sentinel.gov"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Assigned Role:</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="h-8 w-full rounded border bg-card px-2 text-xs font-mono focus:outline-none"
                >
                  <option value="Reviewer">Reviewer</option>
                  <option value="Investigator">Investigator</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!inviteEmail) return;
                  await adminService.inviteUser({
                    email: inviteEmail,
                    role: inviteRole,
                    department: inviteDept,
                    changeReason: 'Initial onboarding invite',
                  });
                  setShowInviteModal(false);
                  refetchUsers();
                }}
              >
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ================= ROLE CHANGE CONFIRMATION DIALOG ================= */}
      {roleChangeUser && (
        <Dialog open={Boolean(roleChangeUser)} onOpenChange={() => setRoleChangeUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Change Role for {roleChangeUser.fullName}</DialogTitle>
              <DialogDescription className="text-xs">
                Modifying user role adjusts access permissions across surveillance data and reports.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-muted/20 border">
                <div>Current Role: <strong>{roleChangeUser.role}</strong></div>
                <div className="mt-2">
                  <label className="block mb-1 text-foreground">Select New Role:</label>
                  <select
                    value={targetNewRole}
                    onChange={(e) => setTargetNewRole(e.target.value as any)}
                    className="h-8 w-full rounded border bg-card px-2 text-xs font-mono focus:outline-none"
                  >
                    <option value="Viewer">Viewer</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Investigator">Investigator</option>
                    <option value="Super Admin">Super Admin (Requires Second Approval)</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setRoleChangeUser(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const targetUser = roleChangeUser;
                  const newRole = targetNewRole;
                  setRoleChangeUser(null);
                  handleOpenChangeModal(
                    `Confirm Role Change to ${newRole}`,
                    `Confirm updating role from ${targetUser.role} to ${newRole}. This action will be audited.`,
                    newRole === 'Super Admin',
                    async (reason, secondAdmin) => {
                      await adminService.updateUserRole(targetUser.id, newRole, reason, secondAdmin);
                      refetchUsers();
                    },
                  );
                }}
              >
                Proceed to Reason Confirmation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
