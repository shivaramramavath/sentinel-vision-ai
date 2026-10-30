import * as fs from 'fs';
import * as path from 'path';
import {
  ROLE_KEYS,
  ROLE_PERMISSIONS,
  ROLE_META,
  ALL_PERMISSIONS,
  generateRbacMarkdown,
  isStepUpPermission,
  normalizeRole,
  isStaffRole,
  isMobileRole,
  Permission,
  Role,
} from '../rbac';

describe('RBAC Single Source of Truth & Matrix Validation', () => {
  it('docs/rbac.md is perfectly in sync with ROLE_PERMISSIONS', () => {
    const rbacDocPath = path.resolve(__dirname, '../../../../docs/rbac.md');
    expect(fs.existsSync(rbacDocPath)).toBe(true);
    const existingContent = fs.readFileSync(rbacDocPath, 'utf8');
    const generatedContent = generateRbacMarkdown();
    expect(existingContent.trim()).toBe(generatedContent.trim());
  });

  it('contains exactly the 5 canonical roles', () => {
    expect(ROLE_KEYS).toHaveLength(5);
    expect(ROLE_KEYS).toEqual([
      'super_admin',
      'investigator',
      'reviewer',
      'viewer',
      'mobile_operator',
    ]);
  });

  it('contains exactly the 50 canonical permissions', () => {
    expect(ALL_PERMISSIONS).toHaveLength(50);
  });

  it('super_admin strictly lacks operational permissions per security policy', () => {
    const superAdminPerms = ROLE_PERMISSIONS.super_admin;

    // Super Admin must not create cases, run searches, decide sightings, export evidence, or view PII
    expect(superAdminPerms).not.toContain('cases:create');
    expect(superAdminPerms).not.toContain('cases:update');
    expect(superAdminPerms).not.toContain('searches:run');
    expect(superAdminPerms).not.toContain('sightings:decide');
    expect(superAdminPerms).not.toContain('evidence:export');
    expect(superAdminPerms).not.toContain('pii:view_contact');
    expect(superAdminPerms).not.toContain('pii:view_medical');

    // Super Admin must have governance & administrative permissions
    expect(superAdminPerms).toContain('users:manage');
    expect(superAdminPerms).toContain('roles:manage');
    expect(superAdminPerms).toContain('audit:read');
    expect(superAdminPerms).toContain('thresholds:approve');
    expect(superAdminPerms).toContain('retention:manage');
    expect(superAdminPerms).toContain('admin:system');
  });

  it('mobile_operator has strictly device and stream permissions', () => {
    const mobilePerms = ROLE_PERMISSIONS.mobile_operator;
    expect(mobilePerms).toEqual([
      'mobile:profile',
      'mobile:devices_own',
      'mobile:stream_own',
    ]);

    // Forbidden from staff resources
    expect(mobilePerms).not.toContain('cases:read');
    expect(mobilePerms).not.toContain('sightings:read');
    expect(mobilePerms).not.toContain('evidence:read');
    expect(mobilePerms).not.toContain('dashboard:read');
  });

  it('viewer role is strictly read-only with no management or decision actions', () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer;
    viewerPerms.forEach((perm) => {
      expect(perm).toMatch(/:(read|view_live|view_recordings)/);
    });
    expect(viewerPerms).not.toContain('cases:create');
    expect(viewerPerms).not.toContain('sightings:decide');
    expect(viewerPerms).not.toContain('evidence:export');
    expect(viewerPerms).not.toContain('pii:view_contact');
  });

  it('normalizes legacy and mixed-case roles idempotently', () => {
    expect(normalizeRole('admin')).toBe('super_admin');
    expect(normalizeRole('Super Admin')).toBe('super_admin');
    expect(normalizeRole('analyst')).toBe('investigator');
    expect(normalizeRole('Investigator')).toBe('investigator');
    expect(normalizeRole('supervisor')).toBe('reviewer');
    expect(normalizeRole('Reviewer')).toBe('reviewer');
    expect(normalizeRole('operator')).toBe('mobile_operator');
    expect(normalizeRole('Mobile Operator')).toBe('mobile_operator');
    expect(normalizeRole('Viewer')).toBe('viewer');
  });

  it('correctly categorizes realms into staff vs mobile', () => {
    expect(isStaffRole('super_admin')).toBe(true);
    expect(isStaffRole('investigator')).toBe(true);
    expect(isStaffRole('reviewer')).toBe(true);
    expect(isStaffRole('viewer')).toBe(true);
    expect(isStaffRole('mobile_operator')).toBe(false);

    expect(isMobileRole('mobile_operator')).toBe(true);
    expect(isMobileRole('investigator')).toBe(false);
  });

  // Table-driven role x permission test
  describe.each([
    { role: 'super_admin' as Role, action: 'users:manage', expected: true },
    { role: 'super_admin' as Role, action: 'searches:run', expected: false },
    { role: 'investigator' as Role, action: 'searches:run', expected: true },
    { role: 'investigator' as Role, action: 'evidence:export', expected: true },
    { role: 'investigator' as Role, action: 'users:manage', expected: false },
    { role: 'reviewer' as Role, action: 'sightings:decide', expected: true },
    { role: 'reviewer' as Role, action: 'cases:create', expected: false },
    { role: 'viewer' as Role, action: 'sightings:read', expected: true },
    { role: 'viewer' as Role, action: 'sightings:decide', expected: false },
    { role: 'mobile_operator' as Role, action: 'mobile:stream_own', expected: true },
    { role: 'mobile_operator' as Role, action: 'dashboard:read', expected: false },
  ])('Matrix check: $role -> $action', ({ role, action, expected }) => {
    it(`should return ${expected} for ${role} on ${action}`, () => {
      const perms = ROLE_PERMISSIONS[role];
      expect(perms.includes(action as Permission)).toBe(expected);
    });
  });
});
