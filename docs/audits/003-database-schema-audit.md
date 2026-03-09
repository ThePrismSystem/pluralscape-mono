# Database Schema Audit 003: Bean-to-Type Alignment

**Date:** 2026-03-09
**Scope:** Audit all ~27 active `db-*` bean schemas against canonical type definitions (`packages/types/src/`), ADRs, and features.md
**Methodology:** Per-bean comparison of table definitions against their corresponding TypeScript types, encryption tier annotations (ADR 006/013), and feature requirements

---

## Executive Summary

The types package (37 files, 300+ types) was completed after the initial database bean authoring. This audit identified **7 critical**, **21 major**, and **6 minor** findings across 18 beans. No beans need scrapping. One new table (device_transfer_requests) is needed. All findings have been resolved by updating the affected beans.

### Intentional Divergences (no action needed)

| Bean    | Divergence                                                                 | Rationale                                                    |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| db-i2gl | No `settingsId` on systems table                                           | 1:1 FK goes the other way (`system_settings.system_id`)      |
| db-7er7 | `friend_bucket_assignments` junction table vs type's `assignedBucketIds[]` | Correct DB normalization of array field                      |
| db-7er7 | `key_version` on `key_grants` (not in type)                                | DB-level optimization for key rotation queries               |
| db-8su3 | Separate table vs embedded in `SystemSettings`                             | Physical separation for independent query/update patterns    |
| db-fe5s | Simpler schema than `JobDefinition` type                                   | SQLite fallback by design (ADR 010); PG uses BullMQ directly |
| db-puza | `group_memberships` has `system_id` (not in type)                          | RLS requirement — DB-only field                              |
| db-btrp | `entity_mappings` as encrypted blob vs typed mappings                      | Serialized storage; type models logical structure            |

### Types with No Corresponding Bean Needed

| Type                                           | Reason                                       |
| ---------------------------------------------- | -------------------------------------------- |
| FrontingReport, ChartData, CoFrontingAnalytics | Computed at query time, not persisted        |
| RealtimeSubscription                           | Runtime WebSocket state                      |
| SyncState, SyncIndicator                       | Runtime client state                         |
| SearchQuery, SearchResult                      | Client-side query objects                    |
| ExportManifest                                 | Derived from export_requests + blob_metadata |

---

## Critical Findings (C1-C7) — Data Model Mismatches

### C1: Missing `fronting_comments` table (db-82q2)

**Type:** `FrontingComment` is a separate entity with its own `id`, `sessionId`, `author`, `content`, `createdAt`, `updatedAt`
**Bean:** Embedded `fronting_comments` as a field inside `fronting_sessions.encrypted_data`
**Resolution:** Add `fronting_comments` table with `id`, `session_id` FK, `system_id` FK (RLS), `version`, `created_at`, `updated_at`, `encrypted_data` (T1 — author, content)

### C2: Missing `positionality` field in fronting_sessions (db-82q2)

**Type:** `FrontingSession` includes `positionality: Positionality` (enum: 'fronting' | 'co-fronting' | 'co-conscious' | 'nearby' | 'distant' | 'unknown')
**Bean:** Only has `fronting_type: 'fronting' | 'co-conscious'`
**Resolution:** Replace `fronting_type` with `positionality` in encrypted_data, expand to full 6-value enum

### C3: `subsystem_id` should be `linked_structure` (db-82q2)

**Type:** `FrontingSession` has `linkedStructure?: EntityReference` (polymorphic reference to subsystem, side system, or layer)
**Bean:** Has `subsystem_id` (single FK)
**Resolution:** Replace `subsystem_id` with `linked_structure` as structured `EntityReference` (entityType + entityId) inside encrypted_data

### C4: Missing 3 cross-link tables (db-k37y)

**Type:** `SubsystemLayerLink`, `SubsystemSideSystemLink`, `SideSystemLayerLink` define M:N relationships between structure entities
**Bean:** Only has membership tables (member-to-structure), not structure-to-structure links
**Resolution:** Add 3 cross-link tables: `subsystem_layer_links`, `subsystem_side_system_links`, `side_system_layer_links`

### C5: Only 8 term categories, types define 12 (db-8su3)

**Type:** `NomenclatureSettings` has 12 categories: collective, individual, fronting, switching, co_presence, internal_space, primary_fronter, structure, dormancy, body, amnesia, saturation
**Bean:** Only lists 8 categories (missing dormancy, body, amnesia, saturation)
**Resolution:** Add 4 missing term categories to encrypted_data

### C6: `completeness_level` should be `saturation_level` (db-i2gl)

**Type:** `Member` uses `saturationLevel: SaturationLevel` with values 'full' | 'semi' | 'fragment' | 'blur' | 'undetermined'
**Bean:** Uses `completeness_level` with values 'fragment' | 'demi-member' | 'full'
**Resolution:** Rename to `saturation_level`, align enum values to match type

### C7: No table for DeviceTransferRequest (db-s6p9)

**Type:** `DeviceTransferRequest` is a persisted entity with `id`, `accountId`, `sourceDeviceId`, `targetDeviceId`, `status`, `encryptedKeyBundle`, `createdAt`, `expiresAt`, `completedAt`
**Bean:** No corresponding table defined
**Resolution:** Add `device_transfer_requests` table to db-s6p9

---

## Major Findings (M1-M21) — Functionality Gaps

### M1: friend_connections missing visibility settings (db-7er7)

**Type:** `FriendConnection` includes `visibilitySettings: FriendVisibilitySettings` (showFrontingStatus, showMemberList, showCustomFields, etc.)
**Resolution:** Add visibility settings fields to `friend_connections.encrypted_data`

### M2: Poll missing multiple fields (db-ju0q)

**Type:** `Poll` includes `kind`, `description`, `createdByMemberId`, `endsAt`, `allowMultipleVotes`, `maxVotesPerMember`, `allowAbstain`, `allowVeto`
**Resolution:** Add all missing fields to `polls.encrypted_data`

### M3: PollVote missing fields (db-ju0q)

**Type:** `PollVote` includes `voter` as EntityReference, `optionId` (nullable), `comment`, `isVeto`, `votedAt`
**Resolution:** Expand `poll_votes.encrypted_data`

### M4: BoardMessage missing senderId (db-ju0q)

**Type:** `BoardMessage` includes `senderId`
**Resolution:** Add `senderId` to `board_messages.encrypted_data`

### M5: AcknowledgementRequest missing createdByMemberId (db-ju0q)

**Type:** `AcknowledgementRequest` includes `createdByMemberId`
**Resolution:** Add to `acknowledgements.encrypted_data`

### M6: Channel missing parent_id (db-ju0q)

**Type:** `Channel` includes `parentId` (FK for nested categories, T3)
**Resolution:** Add `parent_id` column (FK → channels, nullable, T3) for category nesting

### M7: Missing friend_notification_preferences table (db-f70u)

**Type:** `FriendNotificationPreference` is a distinct per-friend configuration
**Resolution:** Add `friend_notification_preferences` table

### M8: notification_configs should be per-event-type rows (db-f70u)

**Type:** `NotificationConfig` is per-event-type with `eventType`, `enabled`, `channels[]`, `quietHoursOverride`
**Resolution:** Restructure as rows (one per event type) rather than single encrypted blob

### M9: device_tokens needs system_id (db-f70u)

**Type/ADR:** ID scoping decision: auth tables get both `account_id` and `system_id`
**Resolution:** Add `system_id` column to `device_tokens`

### M10: journal_entries missing fields (db-2e2s)

**Type:** `JournalEntry` includes `author` as EntityReference, `frontingSessionId`, `tags[]`, `linkedEntities[]`
**Resolution:** Add all to `journal_entries.encrypted_data`

### M11: wiki_pages missing fields (db-2e2s)

**Type:** `WikiPage` includes `tags[]`, `linkedEntities[]`
**Resolution:** Add to `wiki_pages.encrypted_data`

### M12: api_keys missing fields (db-3h1c)

**Type:** `ApiKey` includes `systemId`, `expiresAt`, `scopedBucketIds`
**Resolution:** Add `system_id` FK, `expires_at` column, `scoped_bucket_ids` to encrypted or T3 data

### M13: audit_log needs restructuring (db-k9sr)

**Type:** `AuditLogEntry` has both `systemId` and `accountId`, `actor` as structured data, `detail` (not `metadata`)
**Resolution:** Add `system_id`, restructure `actor`, rename `metadata` → `detail`

### M14: blob_metadata missing checksum (db-1dza)

**Type:** `BlobMetadata` includes `checksum` field; `purpose` values differ
**Resolution:** Add `checksum` column; align purpose enum values with type definition

### M15: innerworld entity_type CHECK too restrictive (db-vfhd)

**Type:** Defines 5 entity types (member, landmark, portal, path, annotation), not just 2
**Resolution:** Expand CHECK constraint to allow all 5 entity types

### M16: jobs table missing system_id (db-fe5s)

**Type:** Job needs tenant isolation even in SQLite fallback
**Resolution:** Add `system_id` column for tenant isolation

### M17: webhook_deliveries missing system_id; api_key_id rename (db-nodl)

**Type:** Needs `system_id` for RLS; `api_key_id` should be `crypto_key_id` per ADR 013 naming
**Resolution:** Add `system_id` to deliveries; rename `api_key_id` → `crypto_key_id` on webhook_configs

### M18: import_jobs needs system_id; purge request gaps (db-rcgj)

**Type:** `ImportJob` needs `systemId`; `AccountPurgeRequest` missing `confirmationPhrase`, `scheduledPurgeAt`, and "cancelled" status
**Resolution:** Add `system_id` to import_jobs; expand purge request fields and statuses

### M19: system_settings fields not fully enumerated (db-va9l)

**Type:** `SystemSettings` includes `onboardingComplete`, `saturationLevelsEnabled`, and other fields not listed in bean
**Resolution:** Enumerate all settings fields explicitly in bean description

### M20: custom_fronts missing emoji (db-82q2)

**Type:** `CustomFront` includes `emoji` field
**Resolution:** Add `emoji` to `custom_fronts.encrypted_data`

### M21: webhook payload tier unclear (db-nodl)

**Type:** Webhook payloads are server-generated (event metadata), should be T3 not T1
**Resolution:** Clarify that `encrypted_data` on deliveries stores debug info as T3 (server-generated payload logs)

---

## Minor Findings (m1-m6) — Naming and Consistency

### m1: Member missing notification fields in encrypted_data (db-i2gl)

**Type:** `Member` includes `suppressFriendFrontNotification`, `boardMessageNotificationOnFront`
**Resolution:** Add to `members.encrypted_data` field list

### m2: accounts table missing version column (db-s6p9)

**Type:** Account extends `AuditMetadata` which includes `version`
**Resolution:** Add `version` column to accounts table

### m3: gatekeeper singular → plural (db-k37y)

**Type:** `Layer` has `gatekeeperMemberIds` (plural array)
**Resolution:** Rename `gatekeeper_member_id` → `gatekeeper_member_ids` in encrypted_data

### m4: Structure entities missing visual properties (db-k37y)

**Type:** `Subsystem`, `SideSystem`, `Layer` all have `color`, `imageSource`, `emoji` in their types
**Resolution:** Add visual properties to encrypted_data of all 3 tables

### m5: Single timestamp → split (db-kk2l)

**Type:** `LifecycleEvent` has both `occurredAt` and `recordedAt`
**Resolution:** Replace single `timestamp` with `occurred_at` (T3) + `recorded_at` (T3)

### m6: Search entity types need expansion (db-fvx4)

**Type:** Search covers channels, and structure entities should list all 3 types explicitly
**Resolution:** Add `channel` to indexed entity types; enumerate structure entity types

---

## Encryption Tier Matrix

All tables audited for correct tier assignment per ADR 006 and ADR 013.

| Tier   | Description                       | Examples                                                                       |
| ------ | --------------------------------- | ------------------------------------------------------------------------------ |
| **T1** | E2E encrypted (client holds key)  | Member names, journal content, chat messages, fronting details, structure data |
| **T2** | Bucket-encrypted (shared key)     | Privacy-scoped media, shared profile data                                      |
| **T3** | Server-visible (plaintext/hashed) | Timestamps, status enums, email hashes, storage keys, audit logs               |

### Cross-cutting tier observations:

- All `version`, `created_at`, `updated_at`, `archived`, `archived_at` fields correctly T3
- All `encrypted_data` blobs correctly T1
- `key_grants.encrypted_key` correctly T2
- Webhook URLs, device tokens, and job metadata correctly T3 (server must process)
- Audit log entirely T3 (server-side security monitoring by design)

---

## Bean Actions Summary

### Updated (18 beans)

| Bean    | Key Changes                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------- |
| db-i2gl | Rename completeness_level → saturation_level, align enum, add member notification fields              |
| db-s6p9 | Add version to accounts, add device_transfer_requests table                                           |
| db-82q2 | Add fronting_comments table, positionality field, linked_structure, emoji to custom_fronts            |
| db-7er7 | Add FriendVisibilitySettings to friend_connections                                                    |
| db-k37y | Add 3 cross-link tables, fix gatekeeper naming, add visual properties                                 |
| db-ju0q | Expand polls, poll_votes, board_messages, acknowledgements, channels                                  |
| db-2e2s | Expand journal_entries and wiki_pages encrypted_data                                                  |
| db-kk2l | Split timestamp → occurred_at + recorded_at                                                           |
| db-8su3 | Add 4 missing term categories                                                                         |
| db-va9l | Enumerate all settings fields explicitly                                                              |
| db-vfhd | Expand entity_type CHECK to 5 types                                                                   |
| db-3h1c | Add system_id, expires_at, scoped_bucket_ids                                                          |
| db-k9sr | Add system_id, restructure actor, rename metadata → detail                                            |
| db-1dza | Add checksum, align purpose values                                                                    |
| db-f70u | Add system_id to device_tokens, add friend_notification_preferences, restructure notification_configs |
| db-nodl | Add system_id to deliveries, rename api_key_id → crypto_key_id, fix payload tier                      |
| db-rcgj | Add system_id to import_jobs, fix purge request fields/statuses                                       |
| db-fe5s | Add system_id for tenant isolation                                                                    |

### Dependent bean updates (3 beans)

| Bean    | Changes                                                                      |
| ------- | ---------------------------------------------------------------------------- |
| db-43uo | Add views for fronting_comments, device_transfer_requests, cross-link tables |
| db-771z | Add RLS policies for new tables                                              |
| db-fvx4 | Add channel to indexed entity types, enumerate structure types               |

### New tables added to existing beans

| Table                             | Added to |
| --------------------------------- | -------- |
| `fronting_comments`               | db-82q2  |
| `device_transfer_requests`        | db-s6p9  |
| `subsystem_layer_links`           | db-k37y  |
| `subsystem_side_system_links`     | db-k37y  |
| `side_system_layer_links`         | db-k37y  |
| `friend_notification_preferences` | db-f70u  |

---

## References

- `packages/types/src/*.ts` — canonical type definitions
- `docs/adr/004-database.md` — database architecture
- `docs/adr/006-encryption.md` — encryption tiers
- `docs/adr/009-blob-media-storage.md` — blob storage
- `docs/adr/010-background-jobs.md` — job queue architecture
- `docs/adr/011-key-recovery.md` — key recovery and device transfer
- `docs/adr/013-api-auth-encryption.md` — API authentication model
