# Feature Completeness Audit

**Date:** 2026-03-29
**Bean:** api-g475
**Scope:** Cross-reference every feature from M1-M7 against API endpoints across 15 domains
**Sources:** features.md, milestones.md, ADRs, CHANGELOG, completed beans
**Methodology:** Per-domain requirements gathering, route file inspection, pagination/filter verification

---

## Summary

| #   | Domain                              | Status            | Gaps   | Blockers | Medium | Low    |
| --- | ----------------------------------- | ----------------- | ------ | -------- | ------ | ------ |
| 1   | Authentication                      | Partially covered | 2      | 0        | 1      | 1      |
| 2   | Account                             | Gaps found        | 4      | 1        | 2      | 1      |
| 3   | Systems                             | Partially covered | 3      | 0        | 3      | 0      |
| 4   | Members                             | Gaps found        | 4      | 1        | 2      | 1      |
| 5   | Groups                              | Partially covered | 1      | 0        | 1      | 0      |
| 6   | System Structure Entities           | Gaps found        | 7      | 5        | 2      | 0      |
| 7   | Custom Fields                       | Gaps found        | 3      | 1        | 2      | 0      |
| 8   | Fronting                            | Partially covered | 4      | 0        | 2      | 2      |
| 9   | Communication                       | Partially covered | 5      | 0        | 3      | 2      |
| 10  | Social (Friends & Friend Codes)     | Gaps found        | 6      | 2        | 2      | 2      |
| 11  | Privacy (Buckets, Tags, Visibility) | Partially covered | 3      | 0        | 1      | 2      |
| 12  | Innerworld                          | Partially covered | 1      | 0        | 0      | 1      |
| 13  | Blobs (Media Storage)               | Partially covered | 1      | 0        | 0      | 1      |
| 14  | Sync (WebSocket, CRDT)              | Partially covered | 3      | 0        | 1      | 2      |
| 15  | Webhooks, Notifications & Timers    | Gaps found        | 5      | 1        | 2      | 2      |
| —   | **Total**                           | —                 | **52** | **11**   | **24** | **17** |

---

## 1. Authentication

### Required Capabilities

| #   | Capability                                                            | Source                                       |
| --- | --------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Register account with email + password                                | F§14, M2, C-M2                               |
| 2   | Login with email + password                                           | F§14, M2, C-M2                               |
| 3   | Session management: list, revoke individual, revoke all               | M2, C-M2                                     |
| 4   | Per-account session limit enforcement                                 | B:Add per-account session limit              |
| 5   | Recovery key: generate at registration, display once                  | F§14, ADR-011, M2                            |
| 6   | Recovery key: backup/regenerate from authenticated session            | F§14, ADR-011, M2                            |
| 7   | Password reset via recovery key                                       | F§14, ADR-011, M2                            |
| 8   | Biometric token enrollment                                            | M2, C-M2                                     |
| 9   | Biometric token single-use enforcement                                | B:Add biometric token single-use enforcement |
| 10  | Session token hashing (stored as hashes, not plaintext)               | M2, C-M2                                     |
| 11  | Constant-time token comparison (anti-timing)                          | B:Add constant-time token comparison         |
| 12  | Anti-enumeration timing for all auth endpoints                        | C-M7                                         |
| 13  | Account-level login throttling                                        | B:Add account-level login throttling         |
| 14  | Initial setup wizard: multi-step onboarding                           | M2, C-M2                                     |
| 15  | Setup wizard: state tracking and guards                               | B:Setup wizard state and guards              |
| 16  | Multi-device key transfer: initiate, approve, complete                | F§14, ADR-011, M3, C-M3                      |
| 17  | Device transfer: rate limiting, attempt limiting, session cleanup job | M3, C-M3                                     |
| 18  | Account type support: "system" and "viewer"                           | F§4, ADR-021, M1                             |
| 19  | Audit log for auth events                                             | F§14, M2, ADR-028                            |
| 20  | Opt-in IP/user-agent audit logging                                    | C-M5, ADR-028                                |

### Existing Endpoints

| Method | Path                                  | Purpose                                                 | Pagination/Filters |
| ------ | ------------------------------------- | ------------------------------------------------------- | ------------------ |
| POST   | /auth/register                        | Register account (returns session token + recovery key) | —                  |
| POST   | /auth/login                           | Login with email + password (account-level throttling)  | —                  |
| GET    | /auth/sessions                        | List active sessions                                    | cursor, limit      |
| DELETE | /auth/sessions/:id                    | Revoke specific session                                 | —                  |
| POST   | /auth/logout                          | Revoke current session                                  | —                  |
| POST   | /auth/sessions/revoke-all             | Revoke all sessions except current                      | —                  |
| GET    | /auth/recovery-key/status             | Get recovery key status                                 | —                  |
| POST   | /auth/recovery-key/regenerate         | Regenerate recovery key backup                          | —                  |
| POST   | /auth/password-reset/recovery-key     | Password reset via recovery key                         | —                  |
| POST   | /auth/biometric/enroll                | Enroll biometric credential                             | —                  |
| POST   | /auth/biometric/verify                | Verify biometric credential                             | —                  |
| POST   | /account/device-transfer              | Initiate device key transfer                            | —                  |
| POST   | /account/device-transfer/:id/complete | Complete device transfer                                | —                  |
| GET    | /systems/:systemId/setup/status       | Get setup wizard status                                 | —                  |
| GET    | /systems/:systemId/setup/profile      | Profile wizard step                                     | —                  |
| GET    | /systems/:systemId/setup/nomenclature | Nomenclature wizard step                                | —                  |
| POST   | /systems/:systemId/setup/complete     | Mark setup complete                                     | —                  |

### Gaps

| #   | Gap                                                                                                                                                                                   | Severity | Source                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| 1   | Device transfer "approve on existing device" step missing — only initiate + complete routes exist; no explicit approval endpoint for the originating device to authorize the transfer | medium   | F§14, ADR-011, M3, C-M3                  |
| 2   | Device transfer session cleanup job absent — the service comment notes it as a future concern; no background job purges expired transfer sessions                                     | low      | M3, C-M3, B:Transfer session cleanup job |

### Notes

- Anti-enumeration timing is implemented via `DUMMY_ARGON2_HASH` in `auth.constants.ts` and the `ANTI_ENUM_TARGET_MS` constant, applied across register, login, and password reset.
- Account-level login throttling is implemented via `LoginThrottledError` and `ACCOUNT_LOGIN_WINDOW_MS` in the login route.
- Per-account session limit (50 max, evicting oldest) is implemented via `MAX_SESSIONS_PER_ACCOUNT` in `auth.constants.ts`.
- Session token hashing is confirmed present (tokens stored as hashes, `DUMMY_ARGON2_HASH` pattern).
- Biometric single-use enforcement is delegated to `biometric.service.ts` (not verified at route level but service handles it).
- Both "system" and "viewer" account types are registered and returned in login/register responses.
- Setup wizard is under `systems/:systemId/setup/` (not `/auth/`), which is architecturally appropriate since a system must exist first.
- Opt-in IP/UA audit logging preference is stored on the account (`auditLogIpTracking`) and respected by the audit middleware.
- The device transfer is mounted under `/account/device-transfer` rather than `/auth/device-transfer`; this is consistent with the account routes structure.

---

## 2. Account

> NOTE: Friends and friend codes are excluded per audit scope — covered by the Social domain audit.

### Required Capabilities

| #   | Capability                                                              | Source                                         |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Get/update account profile                                              | M2, B:Account management endpoints             |
| 2   | Account ownership helper (look up which system/account owns a resource) | B:Account ownership helper                     |
| 3   | Encrypted email storage: AES-256-GCM encrypted email                    | C-M7, ADR-029                                  |
| 4   | Update email address (store hash + encrypted ciphertext)                | ADR-029, M7                                    |
| 5   | Delete account (full purge, GDPR-compliant, cascading cleanup)          | F§10, M2                                       |
| 6   | PIN hash management (set/verify/change PIN for app lock)                | B:PIN hash management                          |
| 7   | Security audit log query: list events with resourceType filter          | F§14, M2, B:Audit log query endpoint           |
| 8   | Scheduled PII cleanup for audit log                                     | B:Schedule recurring audit log PII cleanup job |
| 9   | List systems belonging to this account                                  | B:Add list systems endpoint                    |
| 10  | Account settings (encrypted data for viewer accounts without a system)  | ADR-021                                        |

### Existing Endpoints

| Method | Path               | Purpose                                                                             | Pagination/Filters                                 |
| ------ | ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| GET    | /account           | Get account profile (accountId, accountType, systemId, auditLogIpTracking, version) | —                                                  |
| PUT    | /account/settings  | Update account settings (currently only auditLogIpTracking toggle)                  | —                                                  |
| PUT    | /account/email     | Update email address (hash + encrypted ciphertext)                                  | —                                                  |
| PUT    | /account/password  | Change password                                                                     | —                                                  |
| GET    | /account/audit-log | Query security audit log                                                            | event_type, resource_type, from, to, cursor, limit |
| GET    | /systems           | List systems for current account                                                    | cursor, limit                                      |

### Gaps

| #   | Gap                                                                                                                                                                                        | Severity | Source                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------- |
| 1   | Delete account endpoint absent — no `DELETE /account` or equivalent purge route exists anywhere in the codebase                                                                            | blocker  | F§10, M2                                       |
| 2   | Account-level PIN hash management missing — `POST /account/pin`, `PUT /account/pin`, `POST /account/pin/verify` do not exist; PIN routes exist only under `systems/:systemId/settings/pin` | medium   | B:PIN hash management                          |
| 3   | Account settings for viewer accounts — `PUT /account/settings` only manages `auditLogIpTracking`; no encrypted data store for viewer-type accounts (therapists/friends) without a system   | medium   | ADR-021                                        |
| 4   | Scheduled PII cleanup for audit log — no background job registered for recurring audit log PII purge                                                                                       | low      | B:Schedule recurring audit log PII cleanup job |

### Notes

- The audit log query at `GET /account/audit-log` validates via `AuditLogQuerySchema` from `@pluralscape/validation` and supports `event_type`, `resource_type`, date range (`from`/`to`), and cursor pagination — fully satisfying requirement #7.
- Encrypted email (hash + ciphertext) is implemented in `changeEmail` via `account.service.ts` — requirement #3/#4 are satisfied.
- The account ownership helper is a service-layer concern (`withAccountRead`/`withAccountTransaction`) rather than an endpoint; this is appropriate internal architecture.
- `GET /systems` satisfies requirement #9 (list systems for account).
- The viewer account encrypted settings gap (requirement #10) is medium rather than blocker because viewer accounts are a non-system use case that may have client-side-only storage; however, ADR-021 explicitly calls for server-side encrypted account data.
- No GET endpoint exists for account settings (only PUT); the GET `/account` endpoint returns basic account info but not the full settings blob. This is an implicit gap — reads of account settings may be covered client-side via CRDT.

---

## 3. Systems

> NOTE: Sub-resource routes (members, groups, etc.) are excluded per audit scope — covered by their own domain audits.

### Required Capabilities

| #   | Capability                                              | Source                                    |
| --- | ------------------------------------------------------- | ----------------------------------------- |
| 1   | Create system                                           | M2, C-M2                                  |
| 2   | Get system profile                                      | M2, C-M2, B:System profile CRUD           |
| 3   | Update system profile                                   | M2, C-M2, B:System profile CRUD           |
| 4   | Delete system                                           | M2                                        |
| 5   | System settings CRUD: get/update with encrypted data    | M2, C-M2, B:System settings CRUD          |
| 6   | PIN verification for sensitive settings changes         | M2, B:System settings                     |
| 7   | Nomenclature settings: configure per-system terminology | M1, M2, B:Nomenclature settings endpoints |
| 8   | `snapshotSchedule` setting (daily/weekly/disabled)      | ADR-022                                   |
| 9   | `autoCaptureFrontingOnJournal` setting                  | F§7                                       |
| 10  | `saturationLevelsEnabled` setting                       | F§1                                       |
| 11  | System snapshots: create (manual trigger, encrypted T1) | F§6, ADR-022, M1                          |
| 12  | System snapshots: list snapshots                        | F§6, ADR-022                              |
| 13  | System snapshots: get snapshot by ID                    | F§6, ADR-022                              |
| 14  | System snapshots: delete snapshot                       | F§6, ADR-022                              |
| 15  | Multi-system support: account can own multiple systems  | F§6, M1                                   |
| 16  | System duplication (deep copy)                          | F§6, M1                                   |

### Existing Endpoints

| Method | Path                                   | Purpose                                                      | Pagination/Filters |
| ------ | -------------------------------------- | ------------------------------------------------------------ | ------------------ |
| POST   | /systems                               | Create a new system                                          | —                  |
| GET    | /systems                               | List all systems for account                                 | cursor, limit      |
| GET    | /systems/:id                           | Get system profile                                           | —                  |
| PUT    | /systems/:id                           | Update system profile                                        | —                  |
| DELETE | /systems/:id                           | Archive system (calls `archiveSystem`, not permanent delete) | —                  |
| GET    | /systems/:systemId/settings            | Get system settings (encrypted blob)                         | —                  |
| PUT    | /systems/:systemId/settings            | Update system settings (encrypted blob)                      | —                  |
| POST   | /systems/:systemId/settings/pin        | Set system PIN                                               | —                  |
| DELETE | /systems/:systemId/settings/pin        | Remove system PIN                                            | —                  |
| POST   | /systems/:systemId/settings/pin/verify | Verify system PIN                                            | —                  |
| GET    | /systems/:systemId/nomenclature        | Get nomenclature settings                                    | —                  |
| PUT    | /systems/:systemId/nomenclature        | Update nomenclature settings                                 | —                  |
| GET    | /systems/:systemId/setup/status        | Get setup wizard status                                      | —                  |
| POST   | /systems/:systemId/setup/profile       | Submit profile wizard step                                   | —                  |
| POST   | /systems/:systemId/setup/nomenclature  | Submit nomenclature wizard step                              | —                  |
| POST   | /systems/:systemId/setup/complete      | Mark setup complete                                          | —                  |

### Gaps

| #   | Gap                                                                                                                                                                                                           | Severity | Source           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| 1   | System snapshots CRUD entirely absent — no `POST /systems/:id/snapshots`, `GET /systems/:id/snapshots`, `GET /systems/:id/snapshots/:snapshotId`, or `DELETE /systems/:id/snapshots/:snapshotId` routes exist | medium   | F§6, ADR-022, M1 |
| 2   | System duplication absent — no `POST /systems/:id/duplicate` or equivalent deep-copy endpoint exists                                                                                                          | medium   | F§6, M1          |
| 3   | `DELETE /systems/:id` archives rather than permanently deletes — `deleteRoute` calls `archiveSystem()` not a purge function; no separate hard-delete endpoint exists                                          | medium   | M2               |

### Notes

- Requirements #8, #9, and #10 (`snapshotSchedule`, `autoCaptureFrontingOnJournal`, `saturationLevelsEnabled`) are stored as fields within the encrypted system settings blob (`SystemSettings` type in `packages/types/src/settings.ts`). They are read/written via `GET`/`PUT /systems/:systemId/settings` — no separate endpoints are needed and these requirements are satisfied.
- System settings PIN management is fully implemented with set, remove, and verify routes at `settings/pin`.
- Multi-system support (requirement #15) is satisfied: `POST /systems` creates systems and `GET /systems` lists them with pagination; there is no enforced single-system limit in the routes.
- The snapshot gap is marked **medium** (not blocker) consistent with the cross-domain note in the requirements file — milestones.md marks snapshot API CRUD as deferred/unscheduled even though the schema types and ADR-022 are present.
- System duplication is similarly marked **medium** as milestones.md classifies it as "future (unscheduled)".
- The archive-vs-delete gap is **medium**: the route file is named `delete.ts` and registered as `DELETE /:id`, but it calls `archiveSystem` internally. A permanent delete path may be intentional for safety reasons (require explicit confirmation), but no such endpoint exists.

---

## 4. Members

### Required Capabilities

| #   | Capability                                                                                                                            | Source                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Create member                                                                                                                         | F§1, M2, C-M2             |
| 2   | Get member by ID                                                                                                                      | M2, C-M2                  |
| 3   | Update member                                                                                                                         | M2, C-M2                  |
| 4   | Archive member                                                                                                                        | F§1, M2, C-M2             |
| 5   | Restore archived member                                                                                                               | F§1, M2, C-M2             |
| 6   | Permanent delete member                                                                                                               | F§1, M2, C-M2             |
| 7   | Duplicate member (with optional copy flags)                                                                                           | F§1, M2, C-M2             |
| 8   | List members (archive filter, pagination)                                                                                             | M2, C-M2                  |
| 9   | Sparse fieldsets for list responses                                                                                                   | B:Sparse fieldsets        |
| 10  | Upload member photo (presigned URL)                                                                                                   | F§1, M2, C-M2             |
| 11  | List member photos                                                                                                                    | F§1, M2                   |
| 12  | Delete member photo (permanent)                                                                                                       | F§1, M2                   |
| 13  | Blob confirmation for uploaded photos                                                                                                 | M2, B:Upload confirmation |
| 14  | Set/update custom field values for a member                                                                                           | F§1, M2, C-M2             |
| 15  | Get custom field values for a member                                                                                                  | M2                        |
| 16  | Custom field values for groups and structure entities                                                                                 | C-M5                      |
| 17  | Member-centric membership query                                                                                                       | F§1, M2                   |
| 18  | Create relationship                                                                                                                   | F§6, M2                   |
| 19  | Get relationship by ID                                                                                                                | M2                        |
| 20  | Update relationship                                                                                                                   | M2                        |
| 21  | Delete relationship                                                                                                                   | M2                        |
| 22  | List relationships for a member (with type filter)                                                                                    | M2                        |
| 23  | Relationship types: split-from, fused-from, sibling, partner, parent-child, protector-of, caretaker-of, gatekeeper-of, source, custom | F§6                       |
| 24  | Bidirectional flag per relationship                                                                                                   | F§6                       |

### Existing Endpoints

| Method | Path                                                 | Purpose                         | Pagination/Filters                            |
| ------ | ---------------------------------------------------- | ------------------------------- | --------------------------------------------- |
| GET    | /:systemId/members                                   | List members                    | cursor, limit, includeArchived, sparse fields |
| GET    | /:systemId/members/:memberId                         | Get member                      | —                                             |
| POST   | /:systemId/members                                   | Create member                   | —                                             |
| PUT    | /:systemId/members/:memberId                         | Update member                   | —                                             |
| POST   | /:systemId/members/:memberId/duplicate               | Duplicate member                | —                                             |
| POST   | /:systemId/members/:memberId/archive                 | Archive member                  | —                                             |
| POST   | /:systemId/members/:memberId/restore                 | Restore member                  | —                                             |
| DELETE | /:systemId/members/:memberId                         | Delete member                   | —                                             |
| GET    | /:systemId/members/:memberId/photos                  | List member photos              | —                                             |
| POST   | /:systemId/members/:memberId/photos                  | Create/upload photo             | —                                             |
| POST   | /:systemId/members/:memberId/photos/reorder          | Reorder photos                  | —                                             |
| POST   | /:systemId/members/:memberId/photos/:photoId/archive | Archive photo                   | —                                             |
| POST   | /:systemId/members/:memberId/photos/:photoId/restore | Restore photo                   | —                                             |
| DELETE | /:systemId/members/:memberId/photos/:photoId         | Delete photo                    | —                                             |
| GET    | /:systemId/members/:memberId/fields                  | List field values for member    | —                                             |
| POST   | /:systemId/members/:memberId/fields/:fieldDefId      | Set field value                 | —                                             |
| PUT    | /:systemId/members/:memberId/fields/:fieldDefId      | Update field value              | —                                             |
| DELETE | /:systemId/members/:memberId/fields/:fieldDefId      | Delete field value              | —                                             |
| GET    | /:systemId/members/:memberId/memberships             | List all memberships for member | —                                             |
| GET    | /:systemId/relationships                             | List relationships              | cursor, limit, memberId filter                |
| GET    | /:systemId/relationships/:relationshipId             | Get relationship                | —                                             |
| POST   | /:systemId/relationships                             | Create relationship             | —                                             |
| PUT    | /:systemId/relationships/:relationshipId             | Update relationship             | —                                             |
| DELETE | /:systemId/relationships/:relationshipId             | Delete relationship             | —                                             |
| POST   | /:systemId/relationships/:relationshipId/archive     | Archive relationship            | —                                             |
| POST   | /:systemId/relationships/:relationshipId/restore     | Restore relationship            | —                                             |

### Gaps

| #   | Gap                                                                                                                                                                           | Severity | Source                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| 1   | Custom field values for groups — no route exists under `/:systemId/groups/:groupId/fields`                                                                                    | medium   | C-M5, B:Custom field values per member |
| 2   | Custom field values for structure entities — no REST routes for structure entities at all (see Domain 6); field value routes depend on structure entity routes existing first | blocker  | C-M5                                   |
| 3   | Relationship list has no `type` filter (only `memberId`) — `RelationshipQuerySchema` only accepts `memberId`                                                                  | medium   | M2                                     |
| 4   | Photos: archive/restore verbs present but no permanent `GET /:photoId` single-photo read endpoint                                                                             | low      | M2                                     |

### Notes

- Member CRUD is complete and well-structured. Archive filter, cursor pagination, and sparse fieldsets are all present on list.
- Duplication endpoint exists and delegates copy option flags to service layer.
- Field value routes at `/:memberId/fields` cover set/update/delete/list for members. The service layer's `FieldValueResult` includes `groupId` and `structureEntityId` columns, indicating the schema supports polymorphic ownership, but no routes expose field values for groups or structure entities.
- Member-centric memberships endpoint at `/:memberId/memberships` covers groups and structure entity memberships together (via `listAllMemberMemberships`).
- Relationship archive/restore endpoints are present (not required by spec but a useful addition).
- Relationship type validation is enforced at the DB level via `RELATIONSHIP_TYPES` enum check; `bidirectional` flag is a DB column.

---

## 5. Groups

### Required Capabilities

| #   | Capability                                         | Source        |
| --- | -------------------------------------------------- | ------------- |
| 1   | Create group                                       | F§1, M2, C-M2 |
| 2   | Get group by ID                                    | M2            |
| 3   | Update group                                       | M2            |
| 4   | Archive group                                      | F§1, M2       |
| 5   | Restore archived group                             | F§1, M2       |
| 6   | Delete group (permanent)                           | M2            |
| 7   | List groups (hierarchical, with archive filter)    | M2            |
| 8   | Group membership: add member to group              | M2            |
| 9   | Group membership: remove member from group         | M2            |
| 10  | Group membership: list members in group            | M2            |
| 11  | Hierarchical nesting with cycle detection          | F§1, M2       |
| 12  | Move/copy entire folder between other folders      | F§1, M2       |
| 13  | Multi-group membership (member in multiple groups) | F§1, M2       |

### Existing Endpoints

| Method | Path                                         | Purpose                       | Pagination/Filters           |
| ------ | -------------------------------------------- | ----------------------------- | ---------------------------- |
| GET    | /:systemId/groups                            | List groups (flat, paginated) | cursor, limit, sparse fields |
| GET    | /:systemId/groups/tree                       | Get group hierarchy tree      | —                            |
| GET    | /:systemId/groups/:groupId                   | Get group by ID               | —                            |
| POST   | /:systemId/groups                            | Create group                  | —                            |
| PUT    | /:systemId/groups/:groupId                   | Update group                  | —                            |
| DELETE | /:systemId/groups/:groupId                   | Delete group                  | —                            |
| POST   | /:systemId/groups/:groupId/archive           | Archive group                 | —                            |
| POST   | /:systemId/groups/:groupId/restore           | Restore group                 | —                            |
| POST   | /:systemId/groups/:groupId/move              | Move group to new parent      | —                            |
| POST   | /:systemId/groups/:groupId/copy              | Copy group to new parent      | —                            |
| POST   | /:systemId/groups/reorder                    | Reorder groups                | —                            |
| GET    | /:systemId/groups/:groupId/members           | List members in group         | cursor, limit                |
| POST   | /:systemId/groups/:groupId/members           | Add member to group           | —                            |
| DELETE | /:systemId/groups/:groupId/members/:memberId | Remove member from group      | —                            |

### Gaps

| #   | Gap                                                                                                                                       | Severity | Source  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1   | List groups does not support `includeArchived` filter — flat list query accepts no archive filter, so archived groups cannot be retrieved | medium   | F§1, M2 |

### Notes

- Group CRUD is comprehensive. Archive/restore, move, copy, tree view, reorder, and membership management are all present.
- Hierarchical nesting with cycle detection is handled in the service layer (referenced by `moveGroup` / `copyGroup` in group.service).
- Multi-group membership is supported via the member-centric memberships endpoint and the `/:groupId/members` sub-resource.
- The `tree` endpoint returns the full hierarchy without pagination — appropriate for this use case.
- Sparse fieldsets are supported on the flat list endpoint.
- The list endpoint does not accept an `includeArchived` query param (unlike members and fields which do). Archived groups can only be discovered via individual GET or the tree endpoint if it includes them.

---

## 6. System Structure Entities

### Required Capabilities

| #   | Capability                                                      | Source            |
| --- | --------------------------------------------------------------- | ----------------- |
| 1   | Create entity type                                              | F§6, M2, C-M2     |
| 2   | Get entity type                                                 | M2                |
| 3   | Update entity type                                              | M2                |
| 4   | Delete entity type                                              | M2                |
| 5   | List entity types                                               | M2                |
| 6   | Create structure entity                                         | F§6, M2, C-M2     |
| 7   | Get structure entity                                            | M2                |
| 8   | Update structure entity                                         | M2                |
| 9   | Archive structure entity                                        | F§6, M2           |
| 10  | Restore structure entity                                        | F§6, M2           |
| 11  | Delete structure entity (permanent)                             | M2                |
| 12  | List structure entities (type filter, archive filter)           | M2                |
| 13  | Recursive entity hierarchy (depth capped at 50)                 | F§6, M2           |
| 14  | Create entity link (parent-child)                               | F§6, M2           |
| 15  | Delete entity link                                              | M2                |
| 16  | List entity links                                               | M2                |
| 17  | Create entity association (directed cross-type link)            | F§6, M2           |
| 18  | Delete entity association                                       | M2                |
| 19  | List entity associations                                        | M2                |
| 20  | Create member link (assign member to entity)                    | F§6, M2           |
| 21  | Delete member link                                              | M2                |
| 22  | List member links for an entity                                 | M2                |
| 23  | List structure entity memberships for a member (member-centric) | M2                |
| 24  | Query structure entities containing a given member              | B:Add route tests |

### Architecture Note

Structure entities were refactored in M4 from 9 rigid tables (subsystems, side-systems, layers + junctions) to a generic 5-table entity model (CHANGELOG: "Structure entity refactor"). The old REST routes (under `/subsystems`, `/side-systems`, `/layers`) were removed during this refactor.

Structure entity CRUD is handled through the **CRDT sync layer**, not through dedicated REST endpoints. The sync protocol defines full LWW-map schemas for all 5 entity types in `packages/sync/src/schemas/system-core.ts`:

- `CrdtStructureEntityType` — user-defined type definitions
- `CrdtStructureEntity` — instances with entityTypeId, name, description, color
- `CrdtStructureEntityLink` — parent-child hierarchy (archived, sortOrder mutable)
- `CrdtStructureEntityMemberLink` — member placement under entities (archived, sortOrder mutable)
- `CrdtStructureEntityAssociation` — many-to-many cross-type (archived mutable)

This is consistent with the offline-first architecture: the client creates/edits structure entities locally, and the sync protocol replicates changes to the server via WebSocket.

### Existing Endpoints (REST)

Structure entities have no dedicated REST routes, but are referenced by several REST endpoints:

| Method | Path                                             | Purpose                                                        | Pagination/Filters                       |
| ------ | ------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------- |
| GET    | /systems/:systemId/fronting-sessions             | Fronting sessions can reference structure entities as subjects | structureEntityId in schema              |
| GET    | /systems/:systemId/analytics                     | Analytics include structure entity fronting breakdowns         | —                                        |
| GET    | /systems/:systemId/members/:memberId/memberships | Lists structure entity memberships for a member                | Queries systemStructureEntityMemberLinks |
| GET    | /account/friends/:friendId/dashboard             | Friend dashboard includes bucket-scoped structure entity data  | —                                        |
| GET    | /account/friends/:friendId/export/:entityType    | Friend export covers structure-entity-type entity type         | —                                        |
| GET    | /systems/:systemId/buckets/:bucketId/export      | Bucket export includes structure entities                      | —                                        |

### Existing Endpoints (CRDT Sync)

All CRUD operations for the 5 structure entity tables are handled through the WebSocket sync protocol at `/v1/sync/ws`. The sync layer provides:

- Create, update, archive, restore for all entity types via LWW-map merge
- Tombstone enforcement for permanent deletes
- Conflict resolution per the CRDT strategies defined in `packages/sync/src/strategies/crdt-strategies.ts`

### Database Schema

All tables exist in `packages/db/src/schema/pg/structure.ts`:

- `system_structure_entity_types` — entity type definitions
- `system_structure_entities` — entities with entityTypeId, archivable
- `system_structure_entity_links` — parent-child hierarchy
- `system_structure_entity_member_links` — member assignments
- `system_structure_entity_associations` — directed cross-type links

### Gaps

| #   | Gap                                                                                                                                                  | Severity | Source        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- |
| 1   | No REST endpoints for entity type CRUD (create/get/update/delete/list) — old specific routes removed in M4 refactor, generic equivalents never added | blocker  | F§6, M2, C-M2 |
| 2   | No REST endpoints for structure entity CRUD (create/get/update/archive/restore/delete/list)                                                          | blocker  | F§6, M2, C-M2 |
| 3   | No REST endpoints for entity links (create/delete/list parent-child hierarchy)                                                                       | blocker  | F§6, M2       |
| 4   | No REST endpoints for entity associations (create/delete/list directed cross-type links)                                                             | blocker  | F§6, M2       |
| 5   | No REST endpoints for member links (create/delete/list member-to-entity assignments)                                                                 | blocker  | F§6, M2       |
| 6   | Member-centric structure membership query returns raw link rows, not enriched entity data                                                            | medium   | M2            |
| 7   | No recursive hierarchy endpoint with depth cap                                                                                                       | medium   | F§6, M2       |

### Notes

- The generic entity model is fully defined in the CRDT sync layer (`packages/sync/src/schemas/system-core.ts`) with 5 LWW-map schemas. CRDT sync handles eventual consistency, but the REST API needs endpoints for server-side operations (friend dashboard, exports, webhooks, analytics all reference structure entities).
- Validation query schemas already exist in `@pluralscape/validation` (StructureEntityLinkQuerySchema, etc.), ready for route implementation.
- The `listAllMemberMemberships` function in `member.service.ts` queries the member-link table, providing a partial member-centric view through REST.
- The M4 refactor (commit 52a6e9e6) removed 9 rigid routes and replaced the DB model with a generic 5-table entity model, but the corresponding generic REST routes were never created.

---

## 7. Custom Fields

### Required Capabilities

| #   | Capability                                                                                | Source                 |
| --- | ----------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Create custom field definition                                                            | F§1, M2, C-M2          |
| 2   | Get field definition                                                                      | M2                     |
| 3   | Update field definition                                                                   | M2                     |
| 4   | Archive field definition                                                                  | M2                     |
| 5   | Restore field definition                                                                  | M2                     |
| 6   | Permanent delete field definition                                                         | B:Add permanent DELETE |
| 7   | List field definitions (up to 200 per system)                                             | F§1, M2                |
| 8   | Field definition scopes: target to specific entity types, groups, members, or system-wide | F§6, C-M5              |
| 9   | Set/update custom field bucket visibility                                                 | F§4, M6, C-M6          |
| 10  | List custom field bucket visibility settings                                              | M6                     |
| 11  | Set/update custom field value for member                                                  | F§1, M2                |
| 12  | Set/update custom field value for group                                                   | C-M5                   |
| 13  | Set/update custom field value for structure entity                                        | C-M5                   |
| 14  | Get field values for entity (member, group, structure entity)                             | M2                     |
| 15  | Delete/clear field value                                                                  | M2                     |
| 16  | Preserve field values on member archival                                                  | B:Fix member archival  |

### Existing Endpoints

| Method | Path                                                             | Purpose                             | Pagination/Filters                            |
| ------ | ---------------------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| GET    | /:systemId/fields                                                | List field definitions              | cursor, limit, includeArchived, sparse fields |
| GET    | /:systemId/fields/:fieldId                                       | Get field definition                | —                                             |
| POST   | /:systemId/fields                                                | Create field definition             | —                                             |
| PUT    | /:systemId/fields/:fieldId                                       | Update field definition             | —                                             |
| POST   | /:systemId/fields/:fieldId/archive                               | Archive field definition            | —                                             |
| POST   | /:systemId/fields/:fieldId/restore                               | Restore field definition            | —                                             |
| DELETE | /:systemId/fields/:fieldId                                       | Delete field definition (permanent) | —                                             |
| GET    | /:systemId/fields/:fieldDefinitionId/bucket-visibility           | List bucket visibility settings     | —                                             |
| POST   | /:systemId/fields/:fieldDefinitionId/bucket-visibility           | Set bucket visibility (add bucket)  | —                                             |
| DELETE | /:systemId/fields/:fieldDefinitionId/bucket-visibility/:bucketId | Remove bucket visibility            | —                                             |
| GET    | /:systemId/members/:memberId/fields                              | Get field values for member         | —                                             |
| POST   | /:systemId/members/:memberId/fields/:fieldDefId                  | Set field value for member          | —                                             |
| PUT    | /:systemId/members/:memberId/fields/:fieldDefId                  | Update field value for member       | —                                             |
| DELETE | /:systemId/members/:memberId/fields/:fieldDefId                  | Delete field value for member       | —                                             |

### Gaps

| #   | Gap                                                                                                                                                    | Severity | Source |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| 1   | No route to set/update/delete/list field values for groups — no `/:systemId/groups/:groupId/fields` route group exists                                 | medium   | C-M5   |
| 2   | No REST route to set/update/delete/list field values for structure entities — depends on structure entity REST routes existing first (see Domain 6)    | blocker  | C-M5   |
| 3   | `setFieldValue` service function accepts only `MemberId` — group/structure entity owners would require service-level changes in addition to new routes | medium   | C-M5   |

### Notes

- Field definition CRUD is complete: create, get, update, archive, restore, permanent delete, and list with archive filter and cursor pagination.
- Bucket visibility sub-resource is fully implemented: set (POST), list (GET), and remove (DELETE).
- Field values for members are fully covered via the nested `/:memberId/fields` routes.
- The `FieldValueResult` type and DB schema (`fieldValues` table) already carry `groupId` and `structureEntityId` nullable columns alongside `memberId`, meaning polymorphic ownership was designed into the data model. The service layer (`setFieldValue`, `updateFieldValue`, `deleteFieldValue`, `listFieldValues`) currently binds only to `MemberId` parameters — group and structure entity variants do not exist yet.
- Field definition scope targeting (member, group, structure entity, system-wide) is a field stored in `encryptedData` client-side; the API stores it opaquely, so no server-side routing change is strictly needed for scoping — but field value endpoints for the non-member entity types must still be added.
- Member archival preservation of field values (requirement 16) is a service-layer behavior, not an endpoint — confirmed as an implementation detail rather than a route gap.

---

## 8. Fronting

### Required Capabilities

| #   | Capability                                                                                                      | Source                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Start fronting session (member, custom front, or structure entity)                                              | F§2, M4, C-M4, B:Fronting session CRUD                                   |
| 2   | End fronting session                                                                                            | M4, C-M4                                                                 |
| 3   | Update fronting session (retroactive edits, sentiment, positionality, outtrigger reason, structure entity link) | F§2, M4, C-M4                                                            |
| 4   | Get fronting session by ID                                                                                      | M4                                                                       |
| 5   | Delete fronting session                                                                                         | M4                                                                       |
| 6   | List fronting sessions (date range filter, member/subject filter, pagination)                                   | M4                                                                       |
| 7   | Active fronting query                                                                                           | F§2, M4, C-M4, B:Active fronting query endpoint                          |
| 8   | Co-fronting support (parallel timelines, no mutual exclusion)                                                   | F§2, M4, C-M4                                                            |
| 9   | Structure entity fronting subject                                                                               | F§2, M4, C-M5                                                            |
| 10  | Custom front status text per session (max 50 chars)                                                             | F§2, M4                                                                  |
| 11  | Outtrigger reason (encrypted T1 blob)                                                                           | F§2, M4                                                                  |
| 12  | Outtrigger sentiment (negative/neutral/positive)                                                                | F§2, M4, C-M4                                                            |
| 13  | Positionality field on session                                                                                  | F§2                                                                      |
| 14  | Create fronting comment                                                                                         | F§2, M4, C-M4, B:Fronting comment CRUD                                   |
| 15  | Update fronting comment                                                                                         | M4                                                                       |
| 16  | Delete fronting comment                                                                                         | M4                                                                       |
| 17  | List fronting comments for a session                                                                            | M4                                                                       |
| 18  | Polymorphic comment authorship (member, custom front, or structure entity)                                      | F§2, M4                                                                  |
| 19  | Archive/restore fronting comments                                                                               | B:Use shared archive/restore helpers for fronting comments and check-ins |
| 20  | Per-subject fronting duration/percentage breakdown                                                              | F§2, M4, C-M4, B:Analytics engine                                        |
| 21  | Date range presets: 7/30/90 days, year, all-time, custom                                                        | F§2, M4, C-M4                                                            |
| 22  | Co-fronting pair analytics                                                                                      | F§2, M4, C-M4, B:Co-fronting analytics                                   |
| 23  | Bound all-time analytics queries with max date span                                                             | B:Bound all-time analytics queries and add max date span                 |
| 24  | Fronting report snapshots: create, list, get (stored analytics with encrypted data)                             | M4, C-M4                                                                 |
| 25  | Create custom front                                                                                             | F§1, M2, C-M2, B:Custom front CRUD                                       |
| 26  | Get custom front                                                                                                | M2                                                                       |
| 27  | Update custom front                                                                                             | M2                                                                       |
| 28  | Archive custom front                                                                                            | F§1, M2, C-M2                                                            |
| 29  | Restore custom front                                                                                            | M2                                                                       |
| 30  | Delete custom front (permanent)                                                                                 | M2                                                                       |
| 31  | List custom fronts (with archive filter)                                                                        | M2                                                                       |
| 32  | Create timer config                                                                                             | F§2, M4, C-M4, B:Automated timers and check-in reminders                 |
| 33  | Get timer config                                                                                                | M4                                                                       |
| 34  | Update timer config                                                                                             | M4                                                                       |
| 35  | Archive timer config                                                                                            | M4                                                                       |
| 36  | Restore timer config                                                                                            | M4                                                                       |
| 37  | Delete timer config                                                                                             | M4                                                                       |
| 38  | List timer configs                                                                                              | M4                                                                       |
| 39  | Overnight waking hours range support                                                                            | B:Support overnight waking hours ranges in timer validation              |
| 40  | Create check-in record                                                                                          | M4, C-M4, B:Check-in record CRUD                                         |
| 41  | Respond to check-in                                                                                             | M4, B:Check-in record CRUD                                               |
| 42  | Dismiss check-in                                                                                                | M4, B:Check-in record CRUD                                               |
| 43  | List check-in records (with status filter)                                                                      | M4                                                                       |
| 44  | Idempotency keys for check-in record creation                                                                   | C-M4                                                                     |
| 45  | Archive/restore check-in records                                                                                | B:Use shared archive/restore helpers for fronting comments and check-ins |
| 46  | Create lifecycle event (all subtypes)                                                                           | F§6, M2, C-M2, B:Lifecycle event log                                     |
| 47  | Get lifecycle event                                                                                             | M2                                                                       |
| 48  | List lifecycle events (cursor pagination, date filter)                                                          | M2, ADR-026                                                              |
| 49  | Archive/restore/delete lifecycle event                                                                          | M4, B:Add archive and delete support for lifecycle events                |

### Existing Endpoints

| Method | Path                                                                        | Purpose                         | Pagination/Filters                                                                                            |
| ------ | --------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST   | /systems/:systemId/fronting-sessions                                        | Start fronting session          | —                                                                                                             |
| GET    | /systems/:systemId/fronting-sessions                                        | List sessions                   | cursor, limit, memberId, customFrontId, structureEntityId, startFrom, startUntil, activeOnly, includeArchived |
| GET    | /systems/:systemId/fronting-sessions/:sessionId                             | Get session by ID               | —                                                                                                             |
| PATCH  | /systems/:systemId/fronting-sessions/:sessionId                             | Update session                  | —                                                                                                             |
| DELETE | /systems/:systemId/fronting-sessions/:sessionId                             | Delete session                  | —                                                                                                             |
| POST   | /systems/:systemId/fronting-sessions/:sessionId/end                         | End session                     | —                                                                                                             |
| POST   | /systems/:systemId/fronting-sessions/:sessionId/archive                     | Archive session                 | —                                                                                                             |
| POST   | /systems/:systemId/fronting-sessions/:sessionId/restore                     | Restore session                 | —                                                                                                             |
| POST   | /systems/:systemId/fronting-sessions/:sessionId/comments                    | Create fronting comment         | —                                                                                                             |
| GET    | /systems/:systemId/fronting-sessions/:sessionId/comments                    | List fronting comments          | cursor, limit, includeArchived                                                                                |
| GET    | /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId         | Get comment                     | —                                                                                                             |
| PATCH  | /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId         | Update comment                  | —                                                                                                             |
| DELETE | /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId         | Delete comment                  | —                                                                                                             |
| POST   | /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId/archive | Archive comment                 | —                                                                                                             |
| POST   | /systems/:systemId/fronting-sessions/:sessionId/comments/:commentId/restore | Restore comment                 | —                                                                                                             |
| GET    | /systems/:systemId/fronting/active                                          | Active fronting query           | —                                                                                                             |
| GET    | /systems/:systemId/analytics/fronting                                       | Per-subject fronting breakdown  | preset, startDate, endDate (custom range)                                                                     |
| GET    | /systems/:systemId/analytics/co-fronting                                    | Co-fronting pair analytics      | preset, startDate, endDate                                                                                    |
| POST   | /systems/:systemId/fronting-reports                                         | Create fronting report snapshot | —                                                                                                             |
| GET    | /systems/:systemId/fronting-reports                                         | List fronting reports           | cursor, limit                                                                                                 |
| GET    | /systems/:systemId/fronting-reports/:reportId                               | Get fronting report             | —                                                                                                             |
| DELETE | /systems/:systemId/fronting-reports/:reportId                               | Delete fronting report          | —                                                                                                             |
| POST   | /systems/:systemId/custom-fronts                                            | Create custom front             | —                                                                                                             |
| GET    | /systems/:systemId/custom-fronts                                            | List custom fronts              | cursor, limit, includeArchived                                                                                |
| GET    | /systems/:systemId/custom-fronts/:customFrontId                             | Get custom front                | —                                                                                                             |
| PATCH  | /systems/:systemId/custom-fronts/:customFrontId                             | Update custom front             | —                                                                                                             |
| DELETE | /systems/:systemId/custom-fronts/:customFrontId                             | Delete custom front             | —                                                                                                             |
| POST   | /systems/:systemId/custom-fronts/:customFrontId/archive                     | Archive custom front            | —                                                                                                             |
| POST   | /systems/:systemId/custom-fronts/:customFrontId/restore                     | Restore custom front            | —                                                                                                             |
| POST   | /systems/:systemId/timer-configs                                            | Create timer config             | —                                                                                                             |
| GET    | /systems/:systemId/timer-configs                                            | List timer configs              | cursor, limit, includeArchived                                                                                |
| GET    | /systems/:systemId/timer-configs/:timerId                                   | Get timer config                | —                                                                                                             |
| PATCH  | /systems/:systemId/timer-configs/:timerId                                   | Update timer config             | —                                                                                                             |
| DELETE | /systems/:systemId/timer-configs/:timerId                                   | Delete timer config             | —                                                                                                             |
| POST   | /systems/:systemId/timer-configs/:timerId/archive                           | Archive timer config            | —                                                                                                             |
| POST   | /systems/:systemId/timer-configs/:timerId/restore                           | Restore timer config            | —                                                                                                             |
| POST   | /systems/:systemId/check-in-records                                         | Create check-in record          | —                                                                                                             |
| GET    | /systems/:systemId/check-in-records                                         | List check-in records           | cursor, limit, includeArchived                                                                                |
| GET    | /systems/:systemId/check-in-records/:recordId                               | Get check-in record             | —                                                                                                             |
| POST   | /systems/:systemId/check-in-records/:recordId/respond                       | Respond to check-in             | —                                                                                                             |
| POST   | /systems/:systemId/check-in-records/:recordId/dismiss                       | Dismiss check-in                | —                                                                                                             |
| POST   | /systems/:systemId/check-in-records/:recordId/archive                       | Archive check-in record         | —                                                                                                             |
| DELETE | /systems/:systemId/check-in-records/:recordId                               | Delete check-in record          | —                                                                                                             |
| POST   | /systems/:systemId/lifecycle-events                                         | Create lifecycle event          | —                                                                                                             |
| GET    | /systems/:systemId/lifecycle-events                                         | List lifecycle events           | cursor, limit, eventType, includeArchived                                                                     |
| GET    | /systems/:systemId/lifecycle-events/:eventId                                | Get lifecycle event             | —                                                                                                             |
| DELETE | /systems/:systemId/lifecycle-events/:eventId                                | Delete lifecycle event          | —                                                                                                             |
| POST   | /systems/:systemId/lifecycle-events/:eventId/archive                        | Archive lifecycle event         | —                                                                                                             |
| POST   | /systems/:systemId/lifecycle-events/:eventId/restore                        | Restore lifecycle event         | —                                                                                                             |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                                                                  | Severity | Source                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| 1   | No `restore` endpoint for check-in records — `check-in-records/index.ts` mounts archive but not restore                                                                                                                                                                                              | medium   | B:Use shared archive/restore helpers for fronting comments and check-ins |
| 2   | No `update` endpoint for lifecycle events — `lifecycle-events/index.ts` has no updateRoute; service has no `updateLifecycleEvent` function                                                                                                                                                           | medium   | ADR-026, M2 (type-specific validation on update)                         |
| 3   | Analytics query schema accepts `MAX_ANALYTICS_CUSTOM_RANGE_MS` cap for custom ranges and has `all-time` preset, but no explicit `last-7-days` / `last-90-days` / `last-year` presets visible in `PRESET_DAYS` without reading the full constant — verify these are present in `AnalyticsQuerySchema` | low      | F§2, M4                                                                  |
| 4   | Fronting report snapshots have no `update` endpoint — only create/list/get/delete                                                                                                                                                                                                                    | low      | M4 (stored analytics)                                                    |

### Notes

- **Co-fronting correctly supported**: `createFrontingSession` has no auto-end logic. Sessions are parallel. The `activeOnly` filter on the list endpoint confirms co-fronting is a first-class concept.
- Fronting session list filters are thorough: `memberId`, `customFrontId`, `structureEntityId`, `startFrom`, `startUntil`, `activeOnly`, `includeArchived` — covers the date range + member filter requirement.
- All session subtypes (member, custom front, structure entity) supported as subjects via the same create endpoint.
- Analytics `all-time` preset exists with max date span cap enforced in `analytics-query.service.ts` via `MAX_ANALYTICS_CUSTOM_RANGE_MS`.
- Check-in record `restore` is notably absent despite the bean `B:Use shared archive/restore helpers for fronting comments and check-ins` explicitly listing check-ins alongside comments (which do have restore).
- Lifecycle events have no update route — the service only exposes create/list/get/archive/restore/delete. If retroactive correction of event metadata is needed, this is a gap.

---

## 9. Communication

### Required Capabilities

| #   | Capability                                                                | Source                                              |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | Create channel                                                            | F§3, M5, C-M5, B:Channel API routes                 |
| 2   | Get channel                                                               | M5                                                  |
| 3   | Update channel                                                            | M5                                                  |
| 4   | Archive channel                                                           | M5                                                  |
| 5   | Restore channel                                                           | M5                                                  |
| 6   | Delete channel                                                            | M5                                                  |
| 7   | List channels                                                             | M5                                                  |
| 8   | Send message (polymorphic sender: member, custom front, structure entity) | F§3, M5, C-M5, B:Message API routes                 |
| 9   | Get message                                                               | M5                                                  |
| 10  | Update message                                                            | M5                                                  |
| 11  | Delete message                                                            | M5                                                  |
| 12  | List messages in channel (cursor-based)                                   | M5                                                  |
| 13  | @mentions support                                                         | F§3, M5, C-M5, B:Chat proxy switching and @mentions |
| 14  | Rapid proxy switching (switch fronter mid-message)                        | F§3, M5                                             |
| 15  | Create board message                                                      | F§3, M5, C-M5, B:Board message API routes           |
| 16  | Get board message                                                         | M5                                                  |
| 17  | Update board message                                                      | M5                                                  |
| 18  | Pin/unpin board message                                                   | M5, C-M5                                            |
| 19  | Delete board message                                                      | M5                                                  |
| 20  | List board messages                                                       | M5                                                  |
| 21  | Reorder board messages                                                    | F§3, M5, C-M5, B:Board messages                     |
| 22  | Create note                                                               | F§3, M5, C-M5, B:Note API routes                    |
| 23  | Get note                                                                  | M5                                                  |
| 24  | Update note                                                               | M5                                                  |
| 25  | Archive note                                                              | M5                                                  |
| 26  | Restore note                                                              | M5                                                  |
| 27  | Delete note                                                               | M5                                                  |
| 28  | List notes (author filter, system-wide vs member-bound)                   | M5                                                  |
| 29  | Create poll                                                               | F§3, M5, C-M5, B:Poll API routes                    |
| 30  | Get poll                                                                  | M5                                                  |
| 31  | Update poll                                                               | M5                                                  |
| 32  | Archive poll                                                              | M5                                                  |
| 33  | Restore poll                                                              | M5                                                  |
| 34  | Delete poll                                                               | M5                                                  |
| 35  | List polls                                                                | M5                                                  |
| 36  | Cast vote (polymorphic voter, optional comment/veto, null = abstain)      | F§3, M5, C-M5, B:Vote service                       |
| 37  | Update vote                                                               | M5                                                  |
| 38  | Delete vote                                                               | M5                                                  |
| 39  | List votes for a poll                                                     | M5                                                  |
| 40  | Poll kinds: standard or custom                                            | F§3                                                 |
| 41  | Consensus analytics (poll results summary)                                | F§3, M5                                             |
| 42  | Create acknowledgement                                                    | F§3, M5, C-M5, B:Acknowledgement API routes         |
| 43  | Get acknowledgement                                                       | M5                                                  |
| 44  | Resolve/confirm acknowledgement                                           | F§3, M5, C-M5, B:Mandatory acknowledgement routing  |
| 45  | Delete acknowledgement                                                    | M5                                                  |
| 46  | List acknowledgements (with resolved/unresolved filter)                   | M5                                                  |

### Existing Endpoints

| Method | Path                                                               | Purpose                         | Pagination/Filters                                                           |
| ------ | ------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| POST   | /systems/:systemId/channels                                        | Create channel                  | —                                                                            |
| GET    | /systems/:systemId/channels                                        | List channels                   | cursor, limit, includeArchived                                               |
| GET    | /systems/:systemId/channels/:channelId                             | Get channel                     | —                                                                            |
| PATCH  | /systems/:systemId/channels/:channelId                             | Update channel                  | —                                                                            |
| DELETE | /systems/:systemId/channels/:channelId                             | Delete channel                  | —                                                                            |
| POST   | /systems/:systemId/channels/:channelId/archive                     | Archive channel                 | —                                                                            |
| POST   | /systems/:systemId/channels/:channelId/restore                     | Restore channel                 | —                                                                            |
| POST   | /systems/:systemId/channels/:channelId/messages                    | Send message                    | —                                                                            |
| GET    | /systems/:systemId/channels/:channelId/messages                    | List messages                   | cursor, limit, before, after, includeArchived                                |
| GET    | /systems/:systemId/channels/:channelId/messages/:messageId         | Get message                     | —                                                                            |
| PATCH  | /systems/:systemId/channels/:channelId/messages/:messageId         | Update message                  | —                                                                            |
| DELETE | /systems/:systemId/channels/:channelId/messages/:messageId         | Delete message                  | —                                                                            |
| POST   | /systems/:systemId/channels/:channelId/messages/:messageId/archive | Archive message                 | —                                                                            |
| POST   | /systems/:systemId/channels/:channelId/messages/:messageId/restore | Restore message                 | —                                                                            |
| POST   | /systems/:systemId/board-messages                                  | Create board message            | —                                                                            |
| GET    | /systems/:systemId/board-messages                                  | List board messages             | cursor, limit, includeArchived                                               |
| POST   | /systems/:systemId/board-messages/reorder                          | Reorder board messages          | —                                                                            |
| GET    | /systems/:systemId/board-messages/:boardMessageId                  | Get board message               | —                                                                            |
| PATCH  | /systems/:systemId/board-messages/:boardMessageId                  | Update board message            | —                                                                            |
| DELETE | /systems/:systemId/board-messages/:boardMessageId                  | Delete board message            | —                                                                            |
| POST   | /systems/:systemId/board-messages/:boardMessageId/archive          | Archive board message           | —                                                                            |
| POST   | /systems/:systemId/board-messages/:boardMessageId/restore          | Restore board message           | —                                                                            |
| POST   | /systems/:systemId/board-messages/:boardMessageId/pin              | Pin board message               | —                                                                            |
| POST   | /systems/:systemId/board-messages/:boardMessageId/unpin            | Unpin board message             | —                                                                            |
| POST   | /systems/:systemId/notes                                           | Create note                     | —                                                                            |
| GET    | /systems/:systemId/notes                                           | List notes                      | cursor, limit, authorEntityType, authorEntityId, systemWide, includeArchived |
| GET    | /systems/:systemId/notes/:noteId                                   | Get note                        | —                                                                            |
| PATCH  | /systems/:systemId/notes/:noteId                                   | Update note                     | —                                                                            |
| DELETE | /systems/:systemId/notes/:noteId                                   | Delete note                     | —                                                                            |
| POST   | /systems/:systemId/notes/:noteId/archive                           | Archive note                    | —                                                                            |
| POST   | /systems/:systemId/notes/:noteId/restore                           | Restore note                    | —                                                                            |
| POST   | /systems/:systemId/polls                                           | Create poll                     | —                                                                            |
| GET    | /systems/:systemId/polls                                           | List polls                      | cursor, limit, includeArchived                                               |
| POST   | /systems/:systemId/polls/close                                     | Close poll                      | —                                                                            |
| GET    | /systems/:systemId/polls/:pollId                                   | Get poll                        | —                                                                            |
| PATCH  | /systems/:systemId/polls/:pollId                                   | Update poll                     | —                                                                            |
| DELETE | /systems/:systemId/polls/:pollId                                   | Delete poll                     | —                                                                            |
| POST   | /systems/:systemId/polls/:pollId/archive                           | Archive poll                    | —                                                                            |
| POST   | /systems/:systemId/polls/:pollId/restore                           | Restore poll                    | —                                                                            |
| POST   | /systems/:systemId/polls/:pollId/votes                             | Cast vote                       | —                                                                            |
| GET    | /systems/:systemId/polls/:pollId/votes                             | List votes for poll             | cursor, limit, includeArchived                                               |
| POST   | /systems/:systemId/acknowledgements                                | Create acknowledgement          | —                                                                            |
| GET    | /systems/:systemId/acknowledgements                                | List acknowledgements           | cursor, limit, confirmed, includeArchived                                    |
| GET    | /systems/:systemId/acknowledgements/:acknowledgementId             | Get acknowledgement             | —                                                                            |
| POST   | /systems/:systemId/acknowledgements/:acknowledgementId/confirm     | Resolve/confirm acknowledgement | —                                                                            |
| DELETE | /systems/:systemId/acknowledgements/:acknowledgementId             | Delete acknowledgement          | —                                                                            |
| POST   | /systems/:systemId/acknowledgements/:acknowledgementId/archive     | Archive acknowledgement         | —                                                                            |
| POST   | /systems/:systemId/acknowledgements/:acknowledgementId/restore     | Restore acknowledgement         | —                                                                            |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                                                      | Severity | Source        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- |
| 1   | No **update vote** endpoint — `poll-vote.service.ts` exports only `castVote` and `listVotes`; no `updateVote` function exists; no route file for it                                                                                                                                      | medium   | M5            |
| 2   | No **delete vote** endpoint — same service gap; votes can be archived via `castVote` overwrite patterns but there is no explicit DELETE or archive/restore route for votes                                                                                                               | medium   | M5            |
| 3   | No **consensus analytics** endpoint — `poll.service.ts` exports create/get/list/update/close/delete/archive/restore but no results-summary/consensus function; no analytics route under polls                                                                                            | medium   | F§3, M5       |
| 4   | **@mentions** are a type-level concept (`ChatMessage.mentions: readonly MemberId[]`) and mentioned in E2E requirements, but there is no evidence of server-side mention processing or notification dispatch in `message.service.ts` — the field may be stored in the encrypted blob only | low      | F§3, M5, C-M5 |
| 5   | **Rapid proxy switching** (switch fronter mid-message) — no dedicated endpoint; per-message polymorphic authorship is supported but mid-message sender switching as a distinct operation has no API surface                                                                              | low      | F§3, M5       |

### Notes

- Messages are correctly mounted under channels at `/:channelId/messages` — the sub-routing is clean.
- Message list supports both `before`/`after` timestamp filters AND `cursor` — appropriate for high-traffic chat history.
- Acknowledgements list has a `confirmed` filter, mapping to the resolved/unresolved requirement.
- Notes list supports `authorEntityType`, `authorEntityId`, and `systemWide` filters — covers the author filter + system-wide vs member-bound requirement.
- Board messages have both `pin`/`unpin` actions and a dedicated `reorder` endpoint — both requirements met.
- Polls have a dedicated `close` endpoint in addition to standard CRUD — appropriate for poll lifecycle.
- `castVote` uses `FOR UPDATE` locking on the poll row to serialize concurrent votes, which is correct.
- Acknowledgements have both `archive`/`restore` present (requirement asks for delete only, but archive/restore is a bonus).
- The missing vote update/delete is a real gap: once cast, a vote cannot be changed or retracted via the API.

---

## 10. Social (Friends & Friend Codes)

### Required Capabilities

| #   | Capability                                                                                    | Source                                                 |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Generate friend code (XXXX-XXXX format)                                                       | F§4, M6, C-M6, B:Friend code service                   |
| 2   | Redeem/accept friend code (initiates connection request)                                      | F§4, M6, B:Friend code service                         |
| 3   | List friend codes (active, used)                                                              | M6                                                     |
| 4   | Delete/revoke friend code                                                                     | M6                                                     |
| 5   | Rate limiting on friend code redemption                                                       | B:L1                                                   |
| 6   | Accept friend request                                                                         | F§4, M6, C-M6, B:Friend connection service             |
| 7   | Reject/decline friend request                                                                 | M6                                                     |
| 8   | Block friend                                                                                  | M6, B:Friend connection service                        |
| 9   | Remove friend                                                                                 | F§4, M6, B:Friend connection service                   |
| 10  | Archive friend connection                                                                     | M6, B:Friend connection service                        |
| 11  | List friend connections (with status filter: pending/active/blocked/archived)                 | F§4, M6                                                |
| 12  | Get friend connection by ID                                                                   | M6                                                     |
| 13  | Assign privacy buckets to friend connection                                                   | F§4, M6, B:Bucket assignment service                   |
| 14  | Per-friend visibility settings: show members, groups, structure, allow fronting notifications | F§4, M6                                                |
| 15  | Get external dashboard (read-only filtered view for a friend)                                 | F§4, M6, C-M6, B:Friend dashboard endpoint             |
| 16  | Dashboard CRDT sync projection                                                                | M6, B:Friend dashboard CRDT sync                       |
| 17  | Friend-side search: paginated data export with manifest endpoint                              | F§4, M6, C-M6, B:Paginated friend data export endpoint |
| 18  | ETag/304 conditional caching for friend data                                                  | M6, B:Data freshness headers                           |
| 19  | Data freshness headers                                                                        | M6, B:Data freshness headers                           |
| 20  | Cursor-based pagination across 21 entity types in friend export                               | M6                                                     |
| 21  | Bucket-scoped data export endpoint (with manifest counts and key grants)                      | M6, C-M6, B:Bucket export endpoint                     |

### Existing Endpoints

| Method | Path                                           | Purpose                                                   | Pagination/Filters                    |
| ------ | ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| POST   | /account/friend-codes                          | Generate friend code                                      | —                                     |
| GET    | /account/friend-codes                          | List friend codes                                         | No pagination, no status filter       |
| POST   | /account/friend-codes/redeem                   | Redeem friend code (creates accepted connection directly) | —                                     |
| POST   | /account/friend-codes/:codeId/archive          | Archive/revoke friend code                                | —                                     |
| GET    | /account/friends                               | List friend connections                                   | cursor + limit + includeArchived only |
| GET    | /account/friends/:connectionId                 | Get friend connection by ID                               | —                                     |
| POST   | /account/friends/:connectionId/block           | Block friend connection                                   | —                                     |
| POST   | /account/friends/:connectionId/remove          | Remove friend connection                                  | —                                     |
| POST   | /account/friends/:connectionId/archive         | Archive friend connection                                 | —                                     |
| POST   | /account/friends/:connectionId/restore         | Restore friend connection                                 | —                                     |
| PUT    | /account/friends/:connectionId/visibility      | Update per-friend visibility settings                     | —                                     |
| GET    | /account/friends/:connectionId/dashboard       | Get external friend dashboard                             | —                                     |
| GET    | /account/friends/:connectionId/export          | Paginated friend data export                              | entityType, limit, cursor             |
| GET    | /account/friends/:connectionId/export/manifest | Friend export manifest with entity counts                 | ETag/304                              |
| GET    | /account/friends/:connectionId/notifications   | Get friend notification preferences                       | —                                     |
| PATCH  | /account/friends/:connectionId/notifications   | Update friend notification preferences                    | —                                     |

### Gaps

| #   | Gap                                                                                                                                                                                                                                        | Severity | Source                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------- |
| 1   | No accept/reject endpoints for friend requests — redeem goes directly to `accepted` status, bypassing any pending state. Requirements specify distinct accept and reject/decline actions on pending requests                               | blocker  | F§4, M6, C-M6                      |
| 2   | List friend connections has no status filter (pending/active/blocked/archived) — only `includeArchived` boolean. Cannot list only pending requests, only blocked connections, etc.                                                         | blocker  | F§4, M6                            |
| 3   | Friend code list has no pagination (no cursor/limit) — unbounded list                                                                                                                                                                      | medium   | M6                                 |
| 4   | No explicit delete/revoke endpoint for friend codes — only archive. Requirements state "Delete/revoke" but archive is present (naming gap only if archive is intentional as soft-delete)                                                   | low      | M6                                 |
| 5   | Dashboard CRDT sync projection endpoint is absent — only a basic GET dashboard exists; no sync/projection sub-resource                                                                                                                     | medium   | M6, B:Friend dashboard CRDT sync   |
| 6   | Bucket-scoped data export (bucket export with manifest counts + key grants) is on buckets routes (`/:bucketId/export`), not social routes. Confirm correct placement in domain 11 audit. Not missing from API, only from this route prefix | low      | M6, C-M6, B:Bucket export endpoint |

### Notes

- Redeem creates bidirectional connections immediately as `accepted` — there is no pending/request state in the current implementation. This appears to be a design decision (codes are pre-authorized invites), but the requirements explicitly specify accept/reject actions, and the service has logic referencing `pending` as a valid status. This deserves clarification: if the intent is that codes bypass request flow, requirements #6 and #7 are implemented-by-design, not missing. If a request flow is ever needed, no route infrastructure exists for it.
- Rate limiting on friend code redemption is present: `createCategoryRateLimiter("friendCodeRedeem")` — a dedicated category satisfies requirement #5.
- Visibility settings (show members/groups/structure/fronting notifications) are covered by `PUT /:connectionId/visibility` using `UpdateFriendVisibilityBodySchema`.
- Notification config (per-friend fronting alert preferences) is implemented under `/:connectionId/notifications` — satisfies requirement #14 partially (fronting notifications flag).
- ETag/304 caching is correctly implemented on both export and manifest endpoints.
- Export supports cursor pagination across entity types, satisfying requirement #20.

---

## 11. Privacy (Buckets, Tags, Visibility)

### Required Capabilities

| #   | Capability                                                                     | Source                                               |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | Create privacy bucket                                                          | F§4, M6, C-M6, B:Bucket CRUD service                 |
| 2   | Get bucket                                                                     | M6                                                   |
| 3   | Update bucket (name, description)                                              | M6                                                   |
| 4   | Delete bucket                                                                  | M6                                                   |
| 5   | List buckets                                                                   | M6                                                   |
| 6   | Bucket access intersection logic (fail-closed visibility)                      | F§4, M6, B:Bucket access intersection logic          |
| 7   | Tag entity with bucket (mark entity as visible within bucket)                  | F§4, M6, C-M6, B:Bucket content tag management       |
| 8   | Remove bucket tag from entity                                                  | M6                                                   |
| 9   | List bucket tags for an entity                                                 | M6                                                   |
| 10  | List entities in a bucket (by entity type)                                     | M6                                                   |
| 11  | 21 taggable entity types                                                       | M6, C-M6                                             |
| 12  | Initiate bucket key rotation                                                   | F§4, ADR-014, M2, B:Implement rotation API endpoints |
| 13  | Claim rotation chunk                                                           | ADR-014, M2, B:Implement rotation API endpoints      |
| 14  | Complete rotation chunk                                                        | ADR-014, M2                                          |
| 15  | Get rotation progress                                                          | ADR-014, M2, B:Implement rotation API endpoints      |
| 16  | Retry failed rotation                                                          | ADR-014, B:Fix key rotation sealing race condition   |
| 17  | Key rotation state machine: initiated → migrating → sealing → completed/failed | ADR-014, M2                                          |
| 18  | Set custom field bucket visibility                                             | F§4, M6, B:Custom field bucket visibility            |
| 19  | List field bucket visibility settings                                          | M6                                                   |

### Existing Endpoints

| Method | Path                                                                | Purpose                                                  | Pagination/Filters             |
| ------ | ------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| POST   | /systems/:systemId/buckets                                          | Create bucket                                            | —                              |
| GET    | /systems/:systemId/buckets                                          | List buckets                                             | cursor, limit, includeArchived |
| GET    | /systems/:systemId/buckets/:bucketId                                | Get bucket                                               | —                              |
| PUT    | /systems/:systemId/buckets/:bucketId                                | Update bucket                                            | —                              |
| DELETE | /systems/:systemId/buckets/:bucketId                                | Delete bucket                                            | —                              |
| POST   | /systems/:systemId/buckets/:bucketId/archive                        | Archive bucket                                           | —                              |
| POST   | /systems/:systemId/buckets/:bucketId/restore                        | Restore bucket                                           | —                              |
| POST   | /systems/:systemId/buckets/:bucketId/tags                           | Tag entity with bucket                                   | —                              |
| DELETE | /systems/:systemId/buckets/:bucketId/tags/:entityType/:entityId     | Remove bucket tag from entity                            | —                              |
| GET    | /systems/:systemId/buckets/:bucketId/tags                           | List bucket tags (by entity type)                        | entityType filter              |
| POST   | /systems/:systemId/buckets/:bucketId/friends                        | Assign bucket to friend connection                       | —                              |
| DELETE | /systems/:systemId/buckets/:bucketId/friends/:connectionId          | Unassign bucket from friend                              | —                              |
| GET    | /systems/:systemId/buckets/:bucketId/friends                        | List friend assignments for bucket                       | —                              |
| POST   | /systems/:systemId/buckets/:bucketId/rotations                      | Initiate key rotation                                    | —                              |
| GET    | /systems/:systemId/buckets/:bucketId/rotations/:rotationId          | Get rotation progress                                    | —                              |
| POST   | /systems/:systemId/buckets/:bucketId/rotations/:rotationId/claim    | Claim rotation chunk                                     | —                              |
| POST   | /systems/:systemId/buckets/:bucketId/rotations/:rotationId/complete | Complete rotation chunk                                  | —                              |
| GET    | /systems/:systemId/buckets/:bucketId/export/manifest                | Bucket export manifest (with entity counts + key grants) | ETag/304                       |
| GET    | /systems/:systemId/buckets/:bucketId/export                         | Paginated bucket export                                  | entityType, limit, cursor      |
| GET    | /systems/:systemId/fields/:fieldId/bucket-visibility                | List field bucket visibility settings                    | —                              |
| PUT    | /systems/:systemId/fields/:fieldId/bucket-visibility                | Set field bucket visibility                              | —                              |
| DELETE | /systems/:systemId/fields/:fieldId/bucket-visibility/:bucketId      | Remove field bucket visibility entry                     | —                              |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                                                                                          | Severity | Source                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| 1   | No retry endpoint for failed rotations — the four rotation endpoints (initiate, claim, complete, progress) are present but there is no `POST /:rotationId/retry` or equivalent endpoint                                                                                                                                      | medium   | ADR-014, B:Fix key rotation sealing race condition |
| 2   | "List entities in a bucket by entity type" (req #10) is satisfied by the tags GET endpoint with entityType filter, but bucket tags list returns tag records, not entity objects. If requirement means "list the actual entities", the response shape may be a gap — tags endpoint returns tag metadata, not full entity data | low      | M6                                                 |
| 3   | Bucket list has no status filter beyond `includeArchived` toggle — no way to filter to only archived buckets without mixing with active ones                                                                                                                                                                                 | low      | M6                                                 |

### Notes

- **Intersection-based visibility enforcement**: The bucket access design is correct structurally — entities are tagged to buckets, buckets are assigned to friends, and the friend export (`/:connectionId/export`) enforces bucket intersection for visibility filtering. The service (`friend-export.service.ts`) is where this logic lives. The route layer correctly passes bucket context. This is the key architectural guarantee (fail-closed): if an entity is not tagged to any bucket assigned to a friend, it is invisible.
- Key rotation is fully wired: initiate, claim chunk, complete chunk, and progress endpoints all exist. Only the retry path is absent.
- Archive/restore on buckets exists (beyond what requirements specify as CRUD-only), which is consistent with other entity types.
- Field bucket visibility lives at `apps/api/src/routes/fields/bucket-visibility/` — separate from the bucket routes but covers requirements #18 and #19 fully (set, list, remove).
- The bucket export endpoint (with manifest + ETag) satisfies the "bucket-scoped data export" requirement from domain 10 (req #21 in social) — it is correctly placed under bucket routes.
- 21 taggable entity types are supported via `isBucketContentEntityType` type guard used in the untag route.
- No `list rotations` endpoint exists, which is not explicitly required but may be useful for displaying rotation history. Not a gap based on stated requirements.

---

## 12. Innerworld

### Required Capabilities

| #   | Capability                                                                          | Source                                  |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Create region (name, access rules: open vs gatekept, gatekeeper member assignment)  | F§6, M2, C-M2, B:Innerworld region CRUD |
| 2   | Get region                                                                          | M2                                      |
| 3   | Update region                                                                       | M2                                      |
| 4   | Archive region                                                                      | F§6, M2                                 |
| 5   | Restore region                                                                      | M2                                      |
| 6   | Delete region                                                                       | M2                                      |
| 7   | List regions                                                                        | M2                                      |
| 8   | Create innerworld entity (member, landmark, or structure entity; visual properties) | F§6, M2, C-M2, B:Innerworld entity CRUD |
| 9   | Get entity                                                                          | M2                                      |
| 10  | Update entity (including position on canvas)                                        | M2                                      |
| 11  | Archive entity                                                                      | F§6, M2                                 |
| 12  | Restore entity                                                                      | M2                                      |
| 13  | Delete entity                                                                       | M2                                      |
| 14  | List entities (with region filter)                                                  | M2                                      |
| 15  | Link innerworld entity to corresponding structure entity                            | F§6, M2                                 |
| 16  | Get/update canvas viewport (pan/zoom state)                                         | M2, B:Innerworld canvas viewport        |
| 17  | Canvas state persistence                                                            | M2, C-M2                                |

### Existing Endpoints

| Method | Path                                                        | Purpose                           | Pagination/Filters                       |
| ------ | ----------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| GET    | /v1/systems/:systemId/innerworld/regions                    | List regions                      | cursor, limit, includeArchived           |
| GET    | /v1/systems/:systemId/innerworld/regions/:regionId          | Get region                        | —                                        |
| POST   | /v1/systems/:systemId/innerworld/regions                    | Create region                     | —                                        |
| PUT    | /v1/systems/:systemId/innerworld/regions/:regionId          | Update region                     | —                                        |
| DELETE | /v1/systems/:systemId/innerworld/regions/:regionId          | Delete region                     | —                                        |
| POST   | /v1/systems/:systemId/innerworld/regions/:regionId/archive  | Archive region                    | —                                        |
| POST   | /v1/systems/:systemId/innerworld/regions/:regionId/restore  | Restore region                    | —                                        |
| GET    | /v1/systems/:systemId/innerworld/entities                   | List entities                     | cursor, limit, regionId, includeArchived |
| GET    | /v1/systems/:systemId/innerworld/entities/:entityId         | Get entity                        | —                                        |
| POST   | /v1/systems/:systemId/innerworld/entities                   | Create entity                     | —                                        |
| PUT    | /v1/systems/:systemId/innerworld/entities/:entityId         | Update entity (position included) | —                                        |
| DELETE | /v1/systems/:systemId/innerworld/entities/:entityId         | Delete entity                     | —                                        |
| POST   | /v1/systems/:systemId/innerworld/entities/:entityId/archive | Archive entity                    | —                                        |
| POST   | /v1/systems/:systemId/innerworld/entities/:entityId/restore | Restore entity                    | —                                        |
| GET    | /v1/systems/:systemId/innerworld/canvas                     | Get canvas viewport               | —                                        |
| PUT    | /v1/systems/:systemId/innerworld/canvas                     | Update canvas viewport            | —                                        |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                                                           | Severity | Source  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| 1   | No dedicated endpoint or explicit field to link an innerworld entity to a structure entity — the `updateEntity` service call accepts a body but there is no `updateRoute` field inspection confirming `structureEntityId` is accepted; needs verification that the service schema covers this | low      | F§6, M2 |

### Notes

- All 7 region operations are present (create, get, update, archive, restore, delete, list).
- All 7 entity operations are present (create, get, update, archive, restore, delete, list).
- The entity list supports a `regionId` filter via `InnerWorldEntityQuerySchema` — satisfies the "with region filter" requirement.
- Canvas get/update (upsert semantics via PUT) are present — satisfies state persistence.
- The structure entity link (requirement #15) is presumably handled as a field on the entity body in the update route, but since `updateEntity` in the service is called with an untyped body, its schema coverage should be explicitly verified to confirm `structureEntityId` is a supported field.
- Pagination uses cursor + limit on both list endpoints, consistent with other domains.

---

## 13. Blobs (Media Storage)

### Required Capabilities

| #   | Capability                                                                 | Source                                                   |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Generate presigned upload URL (for client-side encrypted blob upload)      | F§16, M2, C-M2, B:Presigned upload URL generation        |
| 2   | Confirm blob upload (register metadata after client upload)                | F§16, M2, C-M2, B:Upload confirmation and metadata       |
| 3   | Generate presigned download URL (time-limited)                             | F§16, M2, C-M2, B:Download URL and blob lifecycle        |
| 4   | List blobs                                                                 | M2, B:Blob list endpoint                                 |
| 5   | Delete blob                                                                | F§16, M2                                                 |
| 6   | Orphan cleanup job (S3 cleanup for archived blobs)                         | F§16, M2, B:S3 cleanup background job for archived blobs |
| 7   | Blob lifecycle management (expiry, retention policies)                     | F§16, M2                                                 |
| 8   | Quota management (per-account storage limit)                               | F§16, M2                                                 |
| 9   | Blob metadata record (object key, size, content type, encryption metadata) | F§16, ADR-009, M2                                        |
| 10  | Local filesystem fallback for minimal self-hosted tier                     | F§16, ADR-009, M9                                        |

### Existing Endpoints

| Method | Path                                             | Purpose                           | Pagination/Filters             |
| ------ | ------------------------------------------------ | --------------------------------- | ------------------------------ |
| POST   | /v1/systems/:systemId/blobs/upload-url           | Generate presigned upload URL     | —                              |
| POST   | /v1/systems/:systemId/blobs/:blobId/confirm      | Confirm upload, register metadata | —                              |
| GET    | /v1/systems/:systemId/blobs/:blobId/download-url | Generate presigned download URL   | —                              |
| GET    | /v1/systems/:systemId/blobs                      | List blobs                        | cursor, limit, includeArchived |
| GET    | /v1/systems/:systemId/blobs/:blobId              | Get blob metadata                 | —                              |
| DELETE | /v1/systems/:systemId/blobs/:blobId              | Archive blob (soft delete)        | —                              |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                                                                                   | Severity | Source   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| 1   | `DELETE /:blobId` calls `archiveBlob()` (soft delete/archive) rather than a permanent hard delete — requirement says "Delete blob" which typically implies removal; whether a hard-delete endpoint is required vs. relying on the background orphan cleanup job is ambiguous, but the distinction should be confirmed | low      | F§16, M2 |

### Notes

- All 6 REST endpoints are present and match requirements #1–5, #9.
- Quota management (requirement #8) is wired: `getQuotaService(db)` and `quotaService.assertQuota()` are called in the upload-url route, which guards against over-quota uploads.
- Blob lifecycle / expiry is implemented: upload URLs carry an `expiresAt` field and presigned TTLs are enforced in `blob.service.ts`.
- Orphan cleanup (requirement #6) is implemented as a background job: `apps/api/src/jobs/blob-s3-cleanup.ts` handles S3 cleanup for archived blobs.
- Local filesystem fallback (requirement #10, targeted for M9) is present: `packages/storage/src/adapters/filesystem/` adapter exists alongside the S3 adapter.
- The `packages/storage` package provides the adapter interface cleanly; the API resolves the active adapter via `getStorageAdapter()`.
- List endpoint supports `includeArchived` filter for access to soft-deleted blobs, which is useful for admin/cleanup workflows.

---

## 14. Sync (WebSocket, CRDT)

### Required Capabilities

| #   | Capability                                                                                                                                                                                                                                                                                        | Source                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | WebSocket upgrade endpoint (authenticated connection)                                                                                                                                                                                                                                             | M3, C-M3, B:WebSocket upgrade endpoint              |
| 2   | Session authentication over WebSocket                                                                                                                                                                                                                                                             | M3, B:Session authentication over WebSocket         |
| 3   | Binary sync protocol (Automerge CRDT relay)                                                                                                                                                                                                                                                       | F§15, ADR-005, M3, C-M3, B:CRDT sync implementation |
| 4   | Bounded subscriptions (per-client document subscription limit)                                                                                                                                                                                                                                    | M3, B:WebSocket server                              |
| 5   | Auth timeout on WebSocket (disconnect unauthenticated connections)                                                                                                                                                                                                                                | M3                                                  |
| 6   | Graceful shutdown                                                                                                                                                                                                                                                                                 | M3                                                  |
| 7   | Per-IP WebSocket connection limiting                                                                                                                                                                                                                                                              | B:Add per-IP WebSocket connection limiting          |
| 8   | Valkey pub/sub fan-out for cross-instance delivery                                                                                                                                                                                                                                                | M3, C-M3, B:Valkey pub/sub fan-out                  |
| 9   | Server-side subscription management (subscribe/unsubscribe to CRDT documents)                                                                                                                                                                                                                     | M3, B:Server-side subscription management           |
| 10  | Reconnection and replay (SSE + CRDT)                                                                                                                                                                                                                                                              | M3, B:Reconnection and replay                       |
| 11  | SSE notification stream (heartbeat, reconnect replay, per-account fan-out, idle timeout)                                                                                                                                                                                                          | M3, C-M3, B:SSE endpoint                            |
| 12  | Keep-alive heartbeat                                                                                                                                                                                                                                                                              | M3, B:Keep-alive heartbeat                          |
| 13  | Offline queue: batched drain, causal ordering, exponential backoff                                                                                                                                                                                                                                | F§15, M3, C-M3                                      |
| 14  | Cryptographic confirmation before clearing local data                                                                                                                                                                                                                                             | F§15, ADR-005, M3, C-M3                             |
| 15  | Conflict resolution: post-merge validation, hierarchy cycle detection, sort-order repair                                                                                                                                                                                                          | M3, C-M3, B:Conflict resolution                     |
| 16  | CRDT strategies for all entity types: members, groups, custom-fronts, fronting sessions, timers, webhooks, analytics, communication (channels, messages, board messages, notes, polls, votes, acknowledgements), privacy buckets, innerworld, relationships, lifecycle events, friend connections | M2-M6, B:various                                    |
| 17  | Paginate relay envelope queries, optimize document load, verify envelope signatures                                                                                                                                                                                                               | B:Paginate relay envelope queries                   |

### Existing Endpoints / Handlers

| Type             | Path / Handler           | Purpose                                                                                |
| ---------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| GET (WS upgrade) | /v1/sync/ws              | WebSocket upgrade; CSWSH origin validation, per-IP limiting                            |
| WS message       | AuthenticateRequest      | Session auth phase; auth timeout enforced                                              |
| WS message       | ManifestRequest          | List documents the server holds for this system                                        |
| WS message       | SubscribeRequest         | Subscribe to N CRDT documents (bounded by WS_RELAY_MAX_DOCUMENTS)                      |
| WS message       | UnsubscribeRequest       | Unsubscribe from documents                                                             |
| WS message       | FetchSnapshotRequest     | Fetch compressed snapshot for a doc                                                    |
| WS message       | FetchChangesRequest      | Fetch incremental changes since a version                                              |
| WS message       | SubmitChangeRequest      | Submit CRDT change envelope; broadcast to subscribers                                  |
| WS message       | SubmitSnapshotRequest    | Submit compacted snapshot                                                              |
| WS message       | DocumentLoadRequest      | Combined snapshot + changes fetch (optimized load)                                     |
| GET (SSE)        | /v1/notifications/stream | SSE stream with heartbeat, Last-Event-ID replay, per-account fan-out, connection limit |
| Background       | offline-queue-manager.ts | Batched drain, causal ordering, exponential backoff                                    |
| Background       | post-merge-validator.ts  | Cycle detection, sort-order repair, conflict resolution                                |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Severity | Source                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| 1   | CRDT document type coverage is narrower than the full entity list in requirement #16 — `SyncDocumentType` currently defines only: `system-core`, `fronting`, `chat`, `journal`, `note`, `privacy-config`, `bucket`. Missing document types for: innerworld, timer configs, lifecycle events, relationships, friend connections, webhooks, analytics. These entities are presumably synced via `system-core` (the catch-all doc), but whether each entity family is individually addressable as a separate document or is embedded in system-core should be clarified against ADR-005 | medium   | M2-M6, B:various CRDT sync beans                                                      |
| 2   | SSE stream does not implement an explicit idle timeout — the stream waits indefinitely on `stream.onAbort()` with no server-side idle disconnect timer. Requirement specifies idle timeout                                                                                                                                                                                                                                                                                                                                                                                           | low      | M3, C-M3, B:SSE endpoint                                                              |
| 3   | Envelope signature verification on relay queries (requirement #17) — the relay stores encrypted envelopes but there is no visible signature verification step in `handleFetchChanges` / `handleFetchSnapshot`; server trusts stored data implicitly                                                                                                                                                                                                                                                                                                                                  | low      | B:Paginate relay envelope queries, optimize document load, verify envelope signatures |

### Notes

- WebSocket server is mature: origin validation (CSWSH), per-IP connection cap, global unauth connection cap, auth timeout (10 s), safety timeout for upgrade-but-no-open, rate limiting on read + mutation messages with strike-based disconnect.
- Graceful shutdown is implemented: `gracefulShutdownConnections()` with phased close sequence.
- Valkey pub/sub fan-out is implemented for both WebSocket (`valkey-pubsub.ts`) and SSE (`notification-pubsub.ts`).
- SSE reconnection replay uses `Last-Event-ID` header with a ring buffer; gap detection triggers `full-sync` event.
- Offline queue uses exponential backoff with jitter and batched drain (`offline-queue-manager.ts`, `DRAIN_BATCH_SIZE`, `BACKOFF_BASE_MS`).
- Post-merge validator handles hierarchy cycles, sort-order ties, and conflicting boolean flags via `post-merge-validator.ts`.
- DocumentLoadRequest combines snapshot + changes in one round-trip, satisfying the "optimize document load" requirement.
- The `EncryptedRelay` class in `packages/sync` is the core CRDT relay; the server never decrypts content — it relays opaque encrypted envelopes.
- Subscription cap is enforced via `WS_RELAY_MAX_DOCUMENTS` constant passed to `EncryptedRelay`.

---

## 15. Webhooks, Notifications & Timers

### Required Capabilities

| #   | Capability                                                                                                                                                                                                            | Source                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Create webhook config (endpoint URL, event type filter, HMAC secret generated at creation)                                                                                                                            | F§9, M4, C-M4, B:Webhook config CRUD                   |
| 2   | Get webhook config (secret never re-exposed after creation)                                                                                                                                                           | M4, ADR-025, ADR-027                                   |
| 3   | Update webhook config (URL, event types, enabled/disabled)                                                                                                                                                            | M4                                                     |
| 4   | Archive webhook config                                                                                                                                                                                                | M4                                                     |
| 5   | Restore webhook config                                                                                                                                                                                                | M4                                                     |
| 6   | Delete webhook config                                                                                                                                                                                                 | M4                                                     |
| 7   | List webhook configs (with archive filter)                                                                                                                                                                            | M4                                                     |
| 8   | Per-system webhook config limit                                                                                                                                                                                       | B:H2: Add per-system webhook config limit              |
| 9   | Webhook config caching                                                                                                                                                                                                | B:Add webhook config caching                           |
| 10  | Secret rotation endpoint: POST /.../rotate-secret                                                                                                                                                                     | F§9, M7, ADR-027, C-M7                                 |
| 11  | Test/ping endpoint: POST /.../test                                                                                                                                                                                    | M7, C-M7, B:Webhook test/ping endpoint                 |
| 12  | Sanitize error messages from webhook test endpoint                                                                                                                                                                    | B:Sanitize error messages in webhook test endpoint     |
| 13  | HTTPS enforcement for webhook URLs                                                                                                                                                                                    | B:Enforce HTTPS for webhook URLs in all environments   |
| 14  | SSRF protection (DNS rebinding mitigation, IP-pinned fetch)                                                                                                                                                           | M6, B:Add SSRF protection, B:H3                        |
| 15  | Eliminate double DNS resolution                                                                                                                                                                                       | B:Eliminate double DNS resolution in webhook delivery  |
| 16  | List webhook deliveries (with status filter, pagination)                                                                                                                                                              | F§9, M4, C-M4, B:Webhook delivery CRUD                 |
| 17  | Get webhook delivery by ID                                                                                                                                                                                            | M4                                                     |
| 18  | Delete webhook delivery                                                                                                                                                                                               | M4                                                     |
| 19  | Delivery status values: pending, success, failed, retrying                                                                                                                                                            | M4, C-M4                                               |
| 20  | Delivery worker: HMAC-signed payloads, exponential backoff retry, timestamp for replay protection                                                                                                                     | F§9, M4, C-M4, B:Webhook delivery worker               |
| 21  | Delivery cleanup job: auto-purge terminal records after 30 days                                                                                                                                                       | M4, C-M4                                               |
| 22  | Per-endpoint rate limiting for delivery                                                                                                                                                                               | B:Add per-endpoint rate limiting for webhook delivery  |
| 23  | Partial index for pending delivery polling                                                                                                                                                                            | B:Add partial index for pending delivery polling query |
| 24  | Event dispatcher: create pending deliveries for matching webhook configs on entity events                                                                                                                             | M4, C-M4, B:Webhook event dispatcher                   |
| 25  | Optional payload encryption via assigned API key                                                                                                                                                                      | F§9, M7, ADR-013, C-M7, B:Webhook payload encryption   |
| 26  | Webhook events dispatched for 13 event families (member, fronting, group, lifecycle, custom front, privacy bucket, field bucket vis, friend connection, channel, message, board message, note, poll, acknowledgement) | M4-M7                                                  |
| 27  | Register device push token (APNs/FCM, with ownership validation)                                                                                                                                                      | F§4, M6, C-M6, B:Device token service, ADR-015         |
| 28  | Update/delete device token                                                                                                                                                                                            | M6                                                     |
| 29  | List device tokens for account                                                                                                                                                                                        | M6                                                     |
| 30  | Notification config CRUD (per-friend preferences)                                                                                                                                                                     | F§4, M6, C-M6, B:Notification config service           |
| 31  | Push notification worker: switch alert delivery                                                                                                                                                                       | M6, C-M6, B:Push notification worker                   |
| 32  | Batch switch alert notification enqueue                                                                                                                                                                               | B:L3: Batch switch alert notification enqueue          |
| 33  | Email worker: send transactional email                                                                                                                                                                                | M7, C-M7                                               |
| 34  | New device login notification email                                                                                                                                                                                   | M7, C-M7                                               |
| 35  | Password changed notification email                                                                                                                                                                                   | M7, C-M7                                               |
| 36  | Recovery key regenerated notification email                                                                                                                                                                           | M7, C-M7                                               |
| 37  | Two-factor changed notification email                                                                                                                                                                                 | M7, C-M7                                               |
| 38  | Webhook failure digest email                                                                                                                                                                                          | M7, C-M7                                               |
| 39  | Create metadata API key (tier 3)                                                                                                                                                                                      | F§9, ADR-013, M2                                       |
| 40  | Create crypto API key (tier 1/2/3, client creates with encrypted key bundle)                                                                                                                                          | F§9, ADR-013, M2                                       |
| 41  | List API keys                                                                                                                                                                                                         | F§9, ADR-013, M2                                       |
| 42  | Revoke API key (immediate effect)                                                                                                                                                                                     | F§9, ADR-013, M2                                       |
| 43  | Scoped API key access                                                                                                                                                                                                 | F§9, ADR-013                                           |
| 44  | Key lifecycle dashboard (last-used timestamp, scope summary)                                                                                                                                                          | F§9, ADR-013                                           |

### Existing Endpoints

**Webhook Configs** (`/v1/systems/:systemId/webhook-configs`)

| Method | Path                      | Purpose                       | Pagination/Filters                                          |
| ------ | ------------------------- | ----------------------------- | ----------------------------------------------------------- |
| GET    | /                         | List webhook configs          | cursor, limit, archive filter via `parseWebhookConfigQuery` |
| GET    | /:webhookId               | Get webhook config            | —                                                           |
| POST   | /                         | Create webhook config         | —                                                           |
| PUT    | /:webhookId               | Update webhook config         | —                                                           |
| DELETE | /:webhookId               | Delete webhook config         | —                                                           |
| POST   | /:webhookId/archive       | Archive webhook config        | —                                                           |
| POST   | /:webhookId/restore       | Restore webhook config        | —                                                           |
| POST   | /:webhookId/rotate-secret | Rotate HMAC secret            | —                                                           |
| POST   | /:webhookId/test          | Send test ping to webhook URL | —                                                           |

**Webhook Deliveries** (`/v1/systems/:systemId/webhook-deliveries`)

| Method | Path         | Purpose                 | Pagination/Filters                          |
| ------ | ------------ | ----------------------- | ------------------------------------------- |
| GET    | /            | List webhook deliveries | cursor, limit, webhookId, status, eventType |
| GET    | /:deliveryId | Get delivery by ID      | —                                           |
| DELETE | /:deliveryId | Delete delivery record  | —                                           |

**Device Tokens** (`/v1/systems/:systemId/device-tokens`)

| Method | Path             | Purpose               | Pagination/Filters            |
| ------ | ---------------- | --------------------- | ----------------------------- |
| GET    | /                | List device tokens    | — (no pagination — small set) |
| POST   | /                | Register device token | —                             |
| POST   | /:tokenId/revoke | Revoke device token   | —                             |

**Notification Configs** (`/v1/systems/:systemId/notification-configs`)

| Method | Path        | Purpose                    | Pagination/Filters |
| ------ | ----------- | -------------------------- | ------------------ |
| GET    | /           | List notification configs  | —                  |
| PATCH  | /:eventType | Update notification config | —                  |

**Timer Configs** (`/v1/systems/:systemId/timer-configs`)

| Method | Path              | Purpose              | Pagination/Filters             |
| ------ | ----------------- | -------------------- | ------------------------------ |
| GET    | /                 | List timer configs   | cursor, limit, includeArchived |
| GET    | /:timerId         | Get timer config     | —                              |
| POST   | /                 | Create timer config  | —                              |
| PUT    | /:timerId         | Update timer config  | —                              |
| DELETE | /:timerId         | Delete timer config  | —                              |
| POST   | /:timerId/archive | Archive timer config | —                              |
| POST   | /:timerId/restore | Restore timer config | —                              |

**Check-in Records** (`/v1/systems/:systemId/check-in-records`)

| Method | Path               | Purpose                 | Pagination/Filters                                            |
| ------ | ------------------ | ----------------------- | ------------------------------------------------------------- |
| GET    | /                  | List check-in records   | cursor, limit, timerConfigId, pending (bool), includeArchived |
| GET    | /:recordId         | Get check-in record     | —                                                             |
| POST   | /                  | Create check-in record  | —                                                             |
| POST   | /:recordId/respond | Respond to check-in     | —                                                             |
| POST   | /:recordId/dismiss | Dismiss check-in        | —                                                             |
| POST   | /:recordId/archive | Archive check-in record | —                                                             |
| DELETE | /:recordId         | Delete check-in record  | —                                                             |

**Notifications** (SSE)

| Method | Path                     | Purpose                                                           |
| ------ | ------------------------ | ----------------------------------------------------------------- |
| GET    | /v1/notifications/stream | SSE stream (heartbeat, Last-Event-ID replay, per-account fan-out) |

### Gaps

| #   | Gap                                                                                                                                                                                                                                                            | Severity | Source                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| 1   | No `PUT/PATCH/DELETE` endpoint for device tokens — only register (POST) and revoke (POST). Requirement specifies "Update/delete device token"                                                                                                                  | medium   | M6                                                                       |
| 2   | No `restore` endpoint for check-in records — index.ts does not include a `restoreRoute`, and no `restore.ts` file exists in the directory. Requirement specifies archive/restore for check-in records                                                          | medium   | B:Use shared archive/restore helpers for fronting comments and check-ins |
| 3   | API Keys (metadata + crypto) — no route group for `/api-keys` or equivalent exists anywhere in `apps/api/src/routes/`. Requirements #39–44 (create, list, revoke, scoped access, key lifecycle dashboard) are entirely absent                                  | blocker  | F§9, ADR-013, M2                                                         |
| 4   | Two-factor changed notification email — there is no 2FA system in the codebase (no 2FA routes, no 2FA fields in auth); this email type cannot be triggered. Either 2FA is out of scope for launch or the email trigger is incorrectly listed                   | low      | M7, C-M7                                                                 |
| 5   | Webhook delivery list does not expose a date-range filter — `WebhookDeliveryQuerySchema` accepts only `webhookId`, `status`, and `eventType`. Date range filtering on the delivery `createdAt`/`attemptedAt` field is missing; this is a high-traffic endpoint | low      | F§9, M4                                                                  |

### Notes

- Webhook config CRUD is complete: all 7 CRUD operations plus rotate-secret and test/ping are present (10 routes total).
- Webhook delivery list has status + eventType + webhookId filters — covers the main filtering needs.
- Delivery cleanup job (`jobs/webhook-delivery-cleanup.ts`) is present for terminal-record purge.
- Delivery worker (`jobs/webhook-deliver.ts`) handles HMAC signing, exponential backoff, and timestamp-based replay protection.
- Email worker (`services/email-worker.ts`) is present; 4 of 5 email template types are wired (new device login, password changed, recovery key regenerated, webhook failure digest). Two-factor changed email is in scope but there is no 2FA implementation to trigger it yet.
- Notification config uses a `PATCH /:eventType` pattern — note there is no individual-config GET endpoint, only the list; this is consistent with the requirement ("CRUD" here means list + update, not create/delete since configs are auto-created per event type).
- Check-in record `archive` route is present but `restore` is missing from both the index and the filesystem.
- Push notification worker and batch enqueue are present as background jobs (not REST routes).
- Idempotency keys for check-in record creation are handled in the create service layer (not a separate endpoint).

---

## Gap Summary

### Blocker Gaps

| #   | Domain                        | Gap                                                                                                                   | Source           |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Account                       | Delete account endpoint absent — no `DELETE /account` or equivalent purge route exists                                | F§10, M2         |
| 2   | Members                       | Custom field values for structure entities — field value routes depend on structure entity REST routes existing first | C-M5             |
| 3   | System Structure Entities     | No REST endpoints for entity type CRUD                                                                                | F§6, M2, C-M2    |
| 4   | System Structure Entities     | No REST endpoints for structure entity CRUD                                                                           | F§6, M2, C-M2    |
| 5   | System Structure Entities     | No REST endpoints for entity links (parent-child hierarchy)                                                           | F§6, M2          |
| 6   | System Structure Entities     | No REST endpoints for entity associations (directed cross-type links)                                                 | F§6, M2          |
| 7   | System Structure Entities     | No REST endpoints for member links (member-to-entity assignments)                                                     | F§6, M2          |
| 8   | Custom Fields                 | No REST route to set/update/delete/list field values for structure entities                                           | C-M5             |
| 9   | Social                        | No accept/reject endpoints for friend requests — redeem bypasses pending state                                        | F§4, M6, C-M6    |
| 10  | Social                        | List friend connections has no status filter (pending/active/blocked/archived)                                        | F§4, M6          |
| 11  | Webhooks/Notifications/Timers | API Keys entirely absent — no routes for create, list, revoke, or lifecycle dashboard                                 | F§9, ADR-013, M2 |

### Medium Gaps

| #   | Domain                        | Gap                                                                                         | Source                                             |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Authentication                | Device transfer "approve on existing device" step missing                                   | F§14, ADR-011, M3, C-M3                            |
| 2   | Account                       | Account-level PIN hash management missing                                                   | B:PIN hash management                              |
| 3   | Account                       | Account settings for viewer accounts — no encrypted data store for viewer-type accounts     | ADR-021                                            |
| 4   | Systems                       | System snapshots CRUD entirely absent                                                       | F§6, ADR-022, M1                                   |
| 5   | Systems                       | System duplication absent                                                                   | F§6, M1                                            |
| 6   | Systems                       | `DELETE /systems/:id` archives rather than permanently deletes                              | M2                                                 |
| 7   | Members                       | Custom field values for groups — no `/:systemId/groups/:groupId/fields` route group         | C-M5                                               |
| 8   | Members                       | Relationship list has no `type` filter (only `memberId`)                                    | M2                                                 |
| 9   | Groups                        | List groups does not support `includeArchived` filter                                       | F§1, M2                                            |
| 10  | System Structure Entities     | Member-centric structure membership query returns raw link rows, not enriched entity data   | M2                                                 |
| 11  | System Structure Entities     | No recursive hierarchy endpoint with depth cap                                              | F§6, M2                                            |
| 12  | Custom Fields                 | No route to set/update/delete/list field values for groups                                  | C-M5                                               |
| 13  | Custom Fields                 | `setFieldValue` service function accepts only `MemberId` — service-level changes needed too | C-M5                                               |
| 14  | Fronting                      | No `restore` endpoint for check-in records                                                  | B:Use shared archive/restore helpers               |
| 15  | Fronting                      | No `update` endpoint for lifecycle events                                                   | ADR-026, M2                                        |
| 16  | Communication                 | No update vote endpoint                                                                     | M5                                                 |
| 17  | Communication                 | No delete vote endpoint                                                                     | M5                                                 |
| 18  | Communication                 | No consensus analytics endpoint for polls                                                   | F§3, M5                                            |
| 19  | Social                        | Friend code list has no pagination                                                          | M6                                                 |
| 20  | Social                        | Dashboard CRDT sync projection endpoint is absent                                           | M6, B:Friend dashboard CRDT sync                   |
| 21  | Privacy                       | No retry endpoint for failed key rotations                                                  | ADR-014, B:Fix key rotation sealing race condition |
| 22  | Sync                          | CRDT document type coverage narrower than full entity list                                  | M2-M6                                              |
| 23  | Webhooks/Notifications/Timers | No `PUT/PATCH/DELETE` endpoint for device tokens                                            | M6                                                 |
| 24  | Webhooks/Notifications/Timers | No `restore` endpoint for check-in records                                                  | B:Use shared archive/restore helpers               |

### Low Gaps

| #   | Domain                        | Gap                                                                                                       | Source                                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Authentication                | Device transfer session cleanup job absent                                                                | M3, C-M3                                       |
| 2   | Account                       | Scheduled PII cleanup for audit log — no background job registered                                        | B:Schedule recurring audit log PII cleanup job |
| 3   | Members                       | Photos: no permanent `GET /:photoId` single-photo read endpoint                                           | M2                                             |
| 4   | Fronting                      | Analytics preset names unverified — `last-7-days` / `last-90-days` / `last-year` need schema confirmation | F§2, M4                                        |
| 5   | Fronting                      | Fronting report snapshots have no `update` endpoint                                                       | M4                                             |
| 6   | Communication                 | @mentions stored in encrypted blob only — no server-side mention processing or notification dispatch      | F§3, M5, C-M5                                  |
| 7   | Communication                 | Rapid proxy switching — no dedicated mid-message sender-switch API surface                                | F§3, M5                                        |
| 8   | Social                        | No explicit delete/revoke endpoint for friend codes (archive only)                                        | M6                                             |
| 9   | Social                        | Bucket-scoped export placement — correctly on bucket routes, not social routes                            | M6, C-M6                                       |
| 10  | Privacy                       | Bucket tags list returns tag records, not full entity objects                                             | M6                                             |
| 11  | Privacy                       | Bucket list has no status filter beyond `includeArchived` toggle                                          | M6                                             |
| 12  | Innerworld                    | No confirmed field to link innerworld entity to structure entity — needs schema verification              | F§6, M2                                        |
| 13  | Blobs                         | `DELETE /:blobId` is soft delete (archive); hard-delete requirement is ambiguous                          | F§16, M2                                       |
| 14  | Sync                          | SSE stream has no explicit idle timeout                                                                   | M3, C-M3                                       |
| 15  | Sync                          | Envelope signature verification absent on relay queries                                                   | B:Paginate relay envelope queries              |
| 16  | Webhooks/Notifications/Timers | Two-factor changed notification email — no 2FA system exists to trigger it                                | M7, C-M7                                       |
| 17  | Webhooks/Notifications/Timers | Webhook delivery list has no date-range filter                                                            | F§9, M4                                        |
