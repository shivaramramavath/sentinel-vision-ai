import {
  ADMIN_SECTIONS,
  firstAccessibleSection,
  hasAnyAdminPermission,
  canAccessSection,
} from '@/config/admin-sections';
import {
  ROLE_KEYS,
  ROLE_META,
  normalizeRole,
  roleLabel,
  Permission,
} from '@sentinel/shared-types';

describe('Admin Sub-Navigation & RBAC Section Logic', () => {
  it('defines valid permissions and metadata for all admin sections', () => {
    expect(ADMIN_SECTIONS.length).toBe(12);

    for (const section of ADMIN_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.label).toBeTruthy();
      expect(section.icon).toBeDefined();
      expect(section.permissions.length).toBeGreaterThan(0);
    }
  });

  it('correctly resolves firstAccessibleSection based on granted permissions', () => {
    // 1. Super admin with users:read
    const adminCan = (p: Permission) => p === 'users:read';
    expect(firstAccessibleSection(adminCan)).toBe('users');
    expect(hasAnyAdminPermission(adminCan)).toBe(true);

    // 2. Investigator with thresholds:propose only
    const investigatorCan = (p: Permission) => p === 'thresholds:propose';
    expect(firstAccessibleSection(investigatorCan)).toBe('thresholds');
    expect(hasAnyAdminPermission(investigatorCan)).toBe(true);

    // 3. User with models:manage only
    const modelMgrCan = (p: Permission) => p === 'models:manage';
    expect(firstAccessibleSection(modelMgrCan)).toBe('models');

    // 4. Viewer with no admin permissions
    const viewerCan = (_p: Permission) => false;
    expect(firstAccessibleSection(viewerCan)).toBeNull();
    expect(hasAnyAdminPermission(viewerCan)).toBe(false);
  });

  it('canAccessSection checks permission match correctly', () => {
    const thresholdsSection = ADMIN_SECTIONS.find((s) => s.id === 'thresholds')!;
    expect(thresholdsSection).toBeDefined();

    expect(canAccessSection(thresholdsSection, (p) => p === 'thresholds:propose')).toBe(true);
    expect(canAccessSection(thresholdsSection, (p) => p === 'thresholds:approve')).toBe(true);
    expect(canAccessSection(thresholdsSection, (p) => p === 'cameras:read')).toBe(false);
  });

  it('correctly normalizes legacy role strings and maps to roleLabel', () => {
    expect(normalizeRole('admin')).toBe('super_admin');
    expect(roleLabel('admin')).toBe('Super Admin');

    expect(normalizeRole('supervisor')).toBe('reviewer');
    expect(roleLabel('supervisor')).toBe('Reviewer');

    expect(normalizeRole('analyst')).toBe('investigator');
    expect(roleLabel('analyst')).toBe('Investigator');

    expect(normalizeRole('operator')).toBe('mobile_operator');
    expect(roleLabel('operator')).toBe('Mobile Operator');

    for (const key of ROLE_KEYS) {
      expect(ROLE_META[key]).toBeDefined();
      expect(roleLabel(key)).toBe(ROLE_META[key].label);
    }
  });
});
