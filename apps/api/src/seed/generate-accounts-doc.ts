import * as path from 'path';
import * as fs from 'fs';
import { ROLE_META, roleLabel, Role } from '@sentinel/shared-types';

export function generateAccountsDoc() {
  const staffAccounts = [
    {
      role: 'super_admin' as Role,
      email: 'admin@sentinel.local',
      name: 'Chief Director Robert Vance',
      badge: 'SVT-001',
      department: 'Directorate of Command & Intelligence',
      notes: 'Full system administration, RBAC control, model promotions, audit logs.',
    },
    {
      role: 'investigator' as Role,
      email: 'sarah.vance@sentinel.local',
      name: 'Insp. Sarah Vance',
      badge: 'INV-4821',
      department: 'Special Missing Persons Division',
      notes: 'Lead investigator with case creation, vector search, sighting verification, and evidence export clearance.',
    },
    {
      role: 'investigator' as Role,
      email: 'm.brody@sentinel.local',
      name: 'Det. Marcus Brody',
      badge: 'MB-1184',
      department: 'Surveillance Review Team',
      notes: 'Field detective with full search and case management capabilities.',
    },
    {
      role: 'reviewer' as Role,
      email: 'marcus.chen@sentinel.local',
      name: 'Officer Marcus Chen',
      badge: 'REV-9204',
      department: 'Biometric Verification Unit',
      notes: 'Verification analyst focused on candidate sightings, assigned dossiers, and read-only evidence.',
    },
    {
      role: 'reviewer' as Role,
      email: 'e.rostova@sentinel.local',
      name: 'Analyst Elena Rostova',
      badge: 'ER-8821',
      department: 'Biometric Vector Forensics',
      notes: 'Senior reviewer validating AI model match clusters.',
    },
    {
      role: 'viewer' as Role,
      email: 'viewer@sentinel.local',
      name: 'Auditor James Kelly',
      badge: 'AUD-1002',
      department: 'Judicial Oversight & Ethics Office',
      notes: 'Read-only stakeholder with access to public dossiers, journeys, and approved reports.',
    },
    {
      role: 'mobile_operator' as Role,
      email: 'operator.live@sentinel.local',
      name: 'Officer Alex Rivera (Patrol)',
      badge: 'MOB-501',
      department: 'Field Tactical Unit',
      notes: 'Mobile field operator with approved WebRTC camera streaming device (mob_dev_01).',
    },
  ];

  const markdownRows = staffAccounts.map((acc) => {
    const meta = ROLE_META[acc.role];
    return `| \`${acc.role}\` (${roleLabel(acc.role)}) | \`${acc.email}\` | ${acc.name} | ${acc.department} | \`${acc.badge}\` | \`${meta.landing}\` | \`${meta.mfaPolicy}\` | ${acc.notes} |`;
  });

  const markdownDoc = `# Sentinel Vision AI — Test Accounts Inventory

> [!IMPORTANT]
> **Security Notice**: Test accounts are provisioned exclusively for non-production environments (\`development\` and \`test\`). The seeder strictly refuses execution in \`production\`.
> 
> Passwords are **never** committed to version control. All seeded test accounts share the passphrase configured in the environment variable \`SEED_DEFAULT_PASSWORD\` within \`apps/api/.env\`.
> 
> Outgoing emails to test domains (\`*.local\`, \`*.internal\`, \`*.test\`, \`example.com/org/net\`) are automatically suppressed by the email processor.

## Provisioned Role Accounts

| Role | Email | Name & Rank | Department | Badge | Landing Route | MFA Policy | Capabilities & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${markdownRows.join('\n')}

## Edge Case Testing Accounts

| Role | Email | Name | Status | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| \`viewer\` | \`pending.officer@sentinel.local\` | Candidate Officer Maya Lin | \`pending_approval\` | Login redirects to \`/pending-approval\` (clearance pending review). |
| \`viewer\` | \`suspended.officer@sentinel.local\` | Former Officer Kyle Hayes | \`suspended\` | Login rejected with 403 Account Suspended. |

## Quick Sign-In Reference

1. Open Web Portal: [\`http://localhost:3000/login\`](http://localhost:3000/login)
2. Enter any email from the table above.
3. Enter the passphrase defined in \`SEED_DEFAULT_PASSWORD\` in your local \`apps/api/.env\`.
4. Mobile Operator field ingestion portal: [\`http://localhost:3000/m/stream\`](http://localhost:3000/m/stream)
`;

  let docsDir = path.resolve(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    docsDir = path.resolve(process.cwd(), '../../docs');
  }
  const docPath = path.join(docsDir, 'test-accounts.md');
  fs.writeFileSync(docPath, markdownDoc, 'utf-8');
  console.log(`📄 Documentation updated at ${docPath}`);

  console.log('\n========================================================================');
  console.log('📋 SENTINEL TEST ACCOUNTS TABLE');
  console.log('========================================================================');
  console.table(
    staffAccounts.map((a) => ({
      Role: a.role,
      Email: a.email,
      Name: a.name,
      Badge: a.badge,
      Department: a.department,
      Landing: ROLE_META[a.role].landing,
    })),
  );
  console.log('🔑 Passphrase: [Configured in SEED_DEFAULT_PASSWORD]');
  console.log('========================================================================\n');
}
