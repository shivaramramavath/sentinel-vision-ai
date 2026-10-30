# Sentinel Vision AI — Role-Based Access Control (RBAC) Specification

> **Notice:** This document is automatically generated from `packages/shared-types/src/rbac/role-permissions.ts`.
> Do not manually edit this file. Update the shared types catalog and re-run docs sync.

## 1. System Roles Overview

| Role Key | Display Label | Realm | Landing Route | Session Max | Idle Timeout | Description |
|---|---|---|---|---|---|---|
| `super_admin` | **Super Admin** | `staff` | `/dashboard` | 3 | 15m | System administration, security oversight, audit reviews and global policy configuration. |
| `investigator` | **Investigator** | `staff` | `/dashboard` | 5 | 30m | Active case management, AI multimodal search, sighting decisions and full evidence custody handling. |
| `reviewer` | **Reviewer** | `staff` | `/review` | 3 | 30m | Sighting candidate verification, assigned dossier inspection, and read-only case evidence review. |
| `viewer` | **Viewer** | `staff` | `/cases` | 2 | 60m | Read-only stakeholder access to non-restricted dossiers, approved reports and confirmed journey hops. |
| `mobile_operator` | **Mobile Operator** | `mobile` | `/m/stream` | 1 | 120m | Dedicated field operator authorized strictly for mobile device registration and video ingestion streaming. |

## 2. Role-Permission Matrix

Permissions are structured as `resource:action`. A checkmark (✅) denotes authorized capability.

| Resource | Permission | Super Admin | Investigator | Reviewer | Viewer | Mobile Operator | Step-Up? |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `dashboard` | `dashboard:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `cases` | `cases:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `cases` | `cases:create` | — | ✅ | — | — | — | — |
| `cases` | `cases:update` | — | ✅ | — | — | — | — |
| `cases` | `cases:assign` | — | ✅ | — | — | — | — |
| `cases` | `cases:close` | — | ✅ | — | — | — | — |
| `references` | `references:manage` | — | ✅ | — | — | — | — |
| `searches` | `searches:run` | — | ✅ | — | — | — | — |
| `searches` | `searches:cancel` | — | ✅ | — | — | — | — |
| `sightings` | `sightings:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `sightings` | `sightings:decide` | — | ✅ | ✅ | — | — | — |
| `sightings` | `sightings:decide_critical` | — | ✅ | — | — | — | — |
| `journeys` | `journeys:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `evidence` | `evidence:read` | — | ✅ | ✅ | — | — | — |
| `evidence` | `evidence:read_metadata` | ✅ | — | — | — | — | — |
| `evidence` | `evidence:export` | — | ✅ | — | — | — | 🔒 Required |
| `evidence` | `evidence:redact` | — | ✅ | — | — | — | — |
| `evidence` | `evidence:legal_hold` | ✅ | ✅ | — | — | — | 🔒 Required |
| `evidence` | `evidence:verify` | ✅ | ✅ | — | — | — | — |
| `reports` | `reports:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `reports` | `reports:generate` | — | ✅ | — | — | — | — |
| `reports` | `reports:approve` | ✅ | ✅ | — | — | — | — |
| `cameras` | `cameras:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `cameras` | `cameras:view_live` | ✅ | ✅ | ✅ | ✅ | — | — |
| `cameras` | `cameras:view_recordings` | ✅ | ✅ | ✅ | ✅ | — | — |
| `cameras` | `cameras:manage` | ✅ | — | — | — | — | — |
| `topology` | `topology:edit` | ✅ | — | — | — | — | — |
| `alerts` | `alerts:read` | ✅ | ✅ | ✅ | ✅ | — | — |
| `alerts` | `alerts:act` | — | ✅ | ✅ | — | — | — |
| `alerts` | `alerts:manage_rules` | ✅ | — | — | — | — | — |
| `users` | `users:read` | ✅ | — | — | — | — | — |
| `users` | `users:manage` | ✅ | — | — | — | — | 🔒 Required |
| `users` | `users:approve` | ✅ | — | — | — | — | — |
| `roles` | `roles:read` | ✅ | — | — | — | — | — |
| `roles` | `roles:manage` | ✅ | — | — | — | — | 🔒 Required |
| `mobile` | `mobile:manage` | ✅ | — | — | — | — | — |
| `mobile` | `mobile:profile` | — | — | — | — | ✅ | — |
| `mobile` | `mobile:devices_own` | — | — | — | — | ✅ | — |
| `mobile` | `mobile:stream_own` | — | — | — | — | ✅ | — |
| `models` | `models:manage` | ✅ | — | — | — | — | — |
| `thresholds` | `thresholds:propose` | ✅ | ✅ | — | — | — | — |
| `thresholds` | `thresholds:approve` | ✅ | — | — | — | — | 🔒 Required |
| `retention` | `retention:manage` | ✅ | — | — | — | — | 🔒 Required |
| `integrations` | `integrations:manage` | ✅ | — | — | — | — | — |
| `apikeys` | `apikeys:manage` | ✅ | — | — | — | — | 🔒 Required |
| `audit` | `audit:read` | ✅ | — | — | — | — | — |
| `audit` | `audit:read_own_cases` | — | ✅ | — | — | — | — |
| `admin` | `admin:system` | ✅ | — | — | — | — | — |
| `pii` | `pii:view_contact` | — | ✅ | — | — | — | — |
| `pii` | `pii:view_medical` | — | ✅ | — | — | — | — |

## 3. Strict Separation of Duties (Four-Eyes & Guardrails)

1. **Super Admin Operational Isolation**: Super Admins cannot execute vector searches (`searches:run`), make sighting verification decisions (`sightings:decide`), create cases (`cases:create`), or export evidence (`evidence:export`). This prevents administrative oversight abuse.
2. **Four-Eyes Verification on Critical Dossiers**: An investigator cannot be the sole decider on an Amber alert / critical case they registered.
3. **Dual-Admin Super Admin Promotion**: Promoting an account to `super_admin` strictly requires a signed change request and confirmation from a second active Super Admin.
4. **Dual-Admin Threshold Activation**: Activating live cosine similarity threshold changes in production requires a second administrator approval.
5. **Report Separation**: An investigator who generated a dossier report cannot be the sole approver (`approver !== generator`).
6. **Realm Isolation**: Mobile operators (`realm: mobile`) possess strictly scoped ingestion tokens (`aud: mobile`) rejected on all command center console endpoints.
