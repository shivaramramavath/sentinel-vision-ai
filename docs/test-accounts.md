# Sentinel Vision AI — Test Accounts Inventory

> [!IMPORTANT]
> **Security Notice**: Test accounts are provisioned exclusively for non-production environments (`development` and `test`). The seeder strictly refuses execution in `production`.
> 
> Passwords are **never** committed to version control. All seeded test accounts share the passphrase configured in the environment variable `SEED_DEFAULT_PASSWORD` within `apps/api/.env`.
> 
> Outgoing emails to test domains (`*.local`, `*.internal`, `*.test`, `example.com/org/net`) are automatically suppressed by the email processor.

## Provisioned Role Accounts

| Role | Email | Name & Rank | Department | Badge | Landing Route | MFA Policy | Capabilities & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `super_admin` (Super Admin) | `admin@sentinel.local` | Chief Director Robert Vance | Directorate of Command & Intelligence | `SVT-001` | `/dashboard` | `required` | Full system administration, RBAC control, model promotions, audit logs. |
| `investigator` (Investigator) | `sarah.vance@sentinel.local` | Insp. Sarah Vance | Special Missing Persons Division | `INV-4821` | `/dashboard` | `required` | Lead investigator with case creation, vector search, sighting verification, and evidence export clearance. |
| `investigator` (Investigator) | `m.brody@sentinel.local` | Det. Marcus Brody | Surveillance Review Team | `MB-1184` | `/dashboard` | `required` | Field detective with full search and case management capabilities. |
| `reviewer` (Reviewer) | `marcus.chen@sentinel.local` | Officer Marcus Chen | Biometric Verification Unit | `REV-9204` | `/review` | `required` | Verification analyst focused on candidate sightings, assigned dossiers, and read-only evidence. |
| `reviewer` (Reviewer) | `e.rostova@sentinel.local` | Analyst Elena Rostova | Biometric Vector Forensics | `ER-8821` | `/review` | `required` | Senior reviewer validating AI model match clusters. |
| `viewer` (Viewer) | `viewer@sentinel.local` | Auditor James Kelly | Judicial Oversight & Ethics Office | `AUD-1002` | `/cases` | `optional` | Read-only stakeholder with access to public dossiers, journeys, and approved reports. |
| `mobile_operator` (Mobile Operator) | `operator.live@sentinel.local` | Officer Alex Rivera (Patrol) | Field Tactical Unit | `MOB-501` | `/m/stream` | `required` | Mobile field operator with approved WebRTC camera streaming device (mob_dev_01). |

## Edge Case Testing Accounts

| Role | Email | Name | Status | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `viewer` | `pending.officer@sentinel.local` | Candidate Officer Maya Lin | `pending_approval` | Login redirects to `/pending-approval` (clearance pending review). |
| `viewer` | `suspended.officer@sentinel.local` | Former Officer Kyle Hayes | `suspended` | Login rejected with 403 Account Suspended. |

## Quick Sign-In Reference

1. Open Web Portal: [`http://localhost:3000/login`](http://localhost:3000/login)
2. Enter any email from the table above.
3. Enter the passphrase defined in `SEED_DEFAULT_PASSWORD` in your local `apps/api/.env`.
4. Mobile Operator field ingestion portal: [`http://localhost:3000/m/stream`](http://localhost:3000/m/stream)
