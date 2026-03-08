# Audit 002: Database Schema Beans vs Features Specification

**Date:** 2026-03-08
**Scope:** All `db-*` beans compared against `docs/planning/features.md` and relevant ADRs
**Verdict:** Schema design is solid overall. 11 missing tables, 23 missing columns/fields, and several index/constraint gaps identified.

---

## A. Missing Tables/Entities

### A1. Push notification configuration and device tokens

**Driven by:** features.md section 4 (push notifications to friends), section 14 (security), ADR 012 (full tier push support)

No bean defines tables for:

- `device_tokens` — stores FCM/APNs device tokens per session/account for push delivery
- `notification_configs` — per-system preferences for which events trigger push notifications to friends (e.g., switch alerts)

Push notification fan-out is listed as a background job type (ADR 010) but there is no schema to store device registration or notification preferences.

### A2. Friend codes

**Driven by:** features.md section 4 ("friend codes")

The `friend_connections` table in `db-7er7` tracks connection state but there is no table or column for **friend codes** — the short shareable codes used to initiate friend requests. This likely needs:

- `friend_codes`: system_id, code (varchar unique), created_at, expires_at (nullable)

### A3. Data import/export tracking

**Driven by:** features.md section 10 (SP import, PK import, JSON/CSV export, data deletion), features.md section 17 (background jobs)

No bean defines tables for:

- `import_jobs` — tracking SP/PK import progress (chunked processing, error log, completion percentage)
- `export_requests` — tracking data export requests (GDPR, JSON/CSV download)
- `account_purge_requests` — tracking GDPR account purge state

ADR 010 lists these as job types but the schema has no table to persist import/export metadata. The SQLite fallback job queue mentions a simple `jobs` table but no bean defines it either.

### A4. SQLite fallback job queue table

**Driven by:** ADR 010 (SQLite-backed in-process queue for minimal tier)

ADR 010 explicitly describes a job table: `id`, `type`, `payload`, `status`, `attempts`, `next_retry_at`, `created_at`. No bean defines this table. While BullMQ handles the hosted tier, the minimal self-hosted tier requires this schema.

### A5. CRDT sync metadata tables

**Driven by:** features.md section 15 (offline-first sync), ADR 005 (Automerge CRDT)

No bean defines tables for:

- `sync_state` — per-entity or per-document sync state (last synced version, Automerge document heads)
- `sync_queue` — offline write queue for pending changes
- `sync_conflicts` — conflict resolution log (even if CRDTs are conflict-free, the app needs to track merge history for debugging)

The `db-2je4` parent bean mentions "co-designed with CRDT sync requirements" but no child bean addresses sync-specific schema.

### A6. Settings/preferences table

**Driven by:** features.md section 13 (accessibility, dark mode, font scaling, littles safe mode), section 14 (PIN/biometric lock)

No bean covers a general `system_settings` or `user_preferences` table for:

- Dark mode / high-contrast mode preference
- Font scaling preference
- PIN code hash / biometric lock enabled flag
- Littles safe mode enabled flag and safe content configuration
- Default privacy bucket for new content
- Notification preferences (local)

The `nomenclature_settings` table (`db-8su3`) is a 1:1 per-system table, but general settings have no equivalent.

### A7. Littles safe mode content table

**Driven by:** features.md section 13 ("configurable safe content: ability to add links, YouTube videos, and other media")

No bean defines a table for safe mode content items (links, videos, media references). This is distinct from blob_metadata and needs its own entity.

### A8. Search index tables (FTS)

**Driven by:** features.md section 8 (full-text search, client-side FTS5)

No bean addresses client-side FTS5 virtual tables. While search runs on decrypted data client-side, the SQLite FTS5 schema needs to be defined:

- `search_index` — FTS5 virtual table for members, notes, journal entries, chat messages, etc.

This is client-only schema but should be tracked since the `packages/db` package owns SQLite definitions.

### A9. Side system membership table

**Driven by:** features.md section 6 ("Members belong to any level of nested structure")

`db-k37y` defines `subsystem_memberships` but there is no `side_system_memberships` join table. Side systems are defined as "parallel groups, not nested inside a member" and members can belong to them, but no M:N join table exists.

### A10. Innerworld entity-to-region assignment

**Driven by:** features.md section 6 (innerworld mapping, members positioned in regions)

`db-vfhd` defines `innerworld_entities` and `innerworld_regions` as separate tables but there is no join table or FK linking entities to regions. An entity (e.g., a member) should be assignable to a region.

### A11. Layer membership table

**Driven by:** features.md section 6 ("Layers — vertically stacked divisions")

`db-k37y` defines `layers` but there is no `layer_memberships` join table to assign members to layers. The types bean (`types-rwnq`) does not define a LayerMembership type either.

---

## B. Missing Columns/Fields per Table

### B1. `accounts` (db-s6p9)

- **Missing `password_hash`** — Argon2id password hash for authentication. ADR 006 key hierarchy derives the master key from the password, but the server also needs to verify the password for session creation. Currently only `email_hash` is defined.
- **Missing `email_salt`** or indication of hash algorithm — needed to verify email during login without storing plaintext.

### B2. `systems` (db-i2gl)

- **Missing `account_id` on systems table is present** (confirmed in scope) — good.
- No issues identified.

### B3. `members` (db-i2gl)

- **Missing `version` column** — the `types-av6x` bean defines audit metadata with a `version: number` field, but `db-i2gl` does not include a version column on the members table. Needed for CRDT conflict resolution / optimistic locking.

### B4. `fronting_sessions` (db-82q2)

- **Missing `fronting_type` column** — The bean says FrontingType is "computed from overlapping sessions, not stored." This is a reasonable design choice, but consider: the type `types-itej` defines `FrontingType: 'fronting' | 'co-fronting' | 'co-conscious'` and specifically calls out "Co-fronting vs co-conscious distinction." Co-conscious cannot be computed from overlapping sessions alone — it requires explicit user input. A stored column or flag is needed.

### B5. `friend_connections` (db-7er7)

- **Missing `friend_code` or `friend_code_id`** — how is the connection initiated? See A2.
- **Missing `updated_at`** — status changes (pending -> accepted -> blocked) should be timestamped.
- **Missing `assigned_bucket_ids`** — the types bean `types-qryr` includes `assignedBucketIds` on `FriendConnection` but the DB bean does not mention this column. This is likely a separate join table (`friend_bucket_assignments`: friend_connection_id, bucket_id) rather than an array column, but neither exists.

### B6. `key_grants` (db-7er7)

- **Missing `created_at`** — when the grant was issued.
- **Missing `revoked_at`** — when/if the grant was revoked (key rotation).

### B7. `bucket_content_tags` (db-7er7)

- **Missing `created_at`** — audit trail for when content was tagged to a bucket.

### B8. `channels` (db-ju0q)

- **Missing `sort_order`** — channels/categories need ordering for drag-and-drop reorder.
- **Missing `created_at`, `updated_at`** — standard audit columns.

### B9. `messages` (db-ju0q)

- **Missing `edited_at`** — if messages can be edited, track when.
- **Missing `deleted`/`archived`** — non-destructive deletion pattern.

### B10. `board_messages` (db-ju0q)

- **Missing `pinned` column** — the types bean `types-8klm` defines `pinned: boolean` on BoardMessage but the DB bean does not include it.
- **Missing `created_at`, `updated_at`** — standard audit columns.

### B11. `notes` (db-ju0q)

- **Missing `created_at`, `updated_at`** — standard audit columns. Critical for notes which are edited over time.

### B12. `polls` (db-ju0q)

- **Missing `created_at`, `closed_at`** — when the poll was created and when it was closed.

### B13. `acknowledgements` (db-ju0q)

- **Missing `created_at`** — when the acknowledgement was sent.

### B14. `api_keys` (db-3h1c)

- Looks complete. Good coverage.

### B15. `blob_metadata` (db-1dza)

- **Missing `encryption_tier`** — should indicate whether the blob is T1 (private) or T2 (bucket-encrypted). Needed for key selection during decryption.
- **Missing `bucket_id`** — for T2 blobs, which bucket key was used for encryption.

### B16. `wiki_pages` (db-2e2s)

- **Missing `archived`/`archived_at`** — features.md section 1 says archival is non-destructive read-only preservation.

### B17. `journal_entries` (db-2e2s)

- **Missing `archived`/`archived_at`** — same archival concern.

### B18. `innerworld_regions` (db-vfhd)

- **`access_type` and `gatekeeper_member_id` are plaintext** — but gatekeeper_member_id references a member identity, which should be T1 encrypted. Leaking which member is a gatekeeper to the server contradicts the privacy model established in db-82q2 and db-k37y where member IDs are encrypted.

### B19. `webhook_configs` (db-nodl)

- **Missing `secret`** — webhook signature secret for HMAC verification by the receiving endpoint. Standard webhook practice.
- **Missing `updated_at`** — for tracking config changes.

### B20. `lifecycle_events` (db-kk2l)

- **Missing `event_type` as plaintext** — currently listed as `varchar` but tier is not specified. If T3, the server can see what types of events occur (splits, fusions, etc.), which could be sensitive. Should be T1 inside encrypted_data.

### B21. `subsystem_memberships` (db-k37y)

- **Missing proper PK columns** — the bean only mentions `encrypted_data (T1 — subsystem_id, member_id)`. If both the subsystem_id and member_id are inside the encrypted blob, the server cannot enforce uniqueness or even know what row to update. This needs at least a surrogate `id` column and `system_id` FK.

### B22. `timer_configs` (db-1icu)

- **Missing `created_at`, `updated_at`** — standard audit columns.

### B23. `check_in_records` (db-1icu)

- **Missing `timer_config_id` FK** — which timer configuration triggered this check-in? Currently no link between the config and the record.

---

## C. Primary Key Design

### C1. Branded IDs consistency

The `types-av6x` bean defines branded IDs for: `SystemId`, `MemberId`, `GroupId`, `BucketId`, `ChannelId`, `MessageId`, `NoteId`, `PollId`, `RelationshipId`, `SubsystemId`, `FieldDefinitionId`, `FieldValueId`, `SessionId`, `EventId`.

**Missing branded IDs for:**

- `AccountId` — accounts table uses UUID but no branded type
- `ApiKeyId` — defined in `types-xay7` but not in `types-av6x`
- `BlobId` — defined in `types-41na` but not in `types-av6x`
- `WebhookId` — defined in `types-m97b` but not in `types-av6x`
- `TimerId` — defined in `types-xmsf` but not in `types-av6x`
- `FriendConnectionId` — no branded type defined
- `SideSystemId` — no branded type defined
- `LayerId` — no branded type defined
- `InnerWorldEntityId`, `InnerWorldRegionId` — no branded types defined

**Recommendation:** Consolidate all branded ID definitions in `types-av6x` or document that domain-specific beans define their own IDs.

### C2. Composite PKs

- `field_bucket_visibility` (db-tu5g): correctly uses composite (field_definition_id, bucket_id)
- `group_memberships` (db-puza): correctly uses composite (group_id, member_id)
- `nomenclature_settings` (db-8su3): correctly uses system_id as PK (1:1)
- `innerworld_canvas` (db-vfhd): correctly uses system_id as PK (1:1)
- `bucket_content_tags` (db-7er7): **missing PK definition** — should be composite (entity_type, entity_id, bucket_id) or a surrogate id
- `subsystem_memberships` (db-k37y): **missing PK** — see B21
- `poll_votes` (db-ju0q): **missing PK definition** — should have surrogate id or be defined clearly

### C3. UUID vs sequential

All tables use UUID, which is correct for a distributed/offline-first system with CRDT sync. UUIDs avoid ID collision between devices. No issues here.

---

## D. Foreign Key Constraints

### D1. Missing FK declarations

Several beans define logical relationships but don't explicitly declare FK constraints:

| Child Table          | Column              | Parent Table                    | Status                         |
| -------------------- | ------------------- | ------------------------------- | ------------------------------ |
| `blob_metadata`      | `thumbnail_blob_id` | `blob_metadata` (self-ref)      | FK declared                    |
| `webhook_configs`    | `api_key_id`        | `api_keys`                      | Logical but FK not declared    |
| `check_in_records`   | (none)              | `timer_configs`                 | **Missing entirely** (see B23) |
| `poll_votes`         | `poll_id`           | `polls`                         | FK declared                    |
| `innerworld_regions` | `parent_region_id`  | `innerworld_regions` (self-ref) | Implicit, not explicit         |

### D2. Cascade rules

Only `db-puza` (groups) explicitly addresses cascade behavior: "deleting a group orphans children (moves to root)."

**Missing cascade rule definitions for:**

- `accounts` deletion -> `sessions`, `auth_keys`, `recovery_keys`, `api_keys`, `audit_log` (CASCADE or RESTRICT?)
- `systems` deletion -> all system-owned tables (CASCADE? This is the GDPR purge path)
- `channels` deletion -> `messages` (CASCADE)
- `polls` deletion -> `poll_votes` (CASCADE)
- `buckets` deletion -> `bucket_content_tags`, `key_grants` (CASCADE)
- `webhook_configs` deletion -> `webhook_deliveries` (CASCADE)

### D3. friend_connections bidirectional FK

`friend_connections` has `system_id` and `friend_system_id`, both referencing `systems`. This is correct but the bean should explicitly note both FKs and that they are asymmetric (requester vs recipient).

---

## E. Indexes

### E1. Missing indexes on FKs used in joins

| Table                     | Column                  | Join Pattern                       | Index?                     |
| ------------------------- | ----------------------- | ---------------------------------- | -------------------------- |
| `field_values`            | `field_definition_id`   | Join to definitions                | **Not specified**          |
| `field_values`            | `member_id`             | Join to members                    | **Not specified**          |
| `field_bucket_visibility` | `bucket_id`             | Join to buckets                    | **Not specified**          |
| `field_bucket_visibility` | `field_definition_id`   | Join to definitions                | **Not specified**          |
| `group_memberships`       | `member_id`             | "Which groups is this member in?"  | **Not specified**          |
| `group_memberships`       | `group_id`              | "Which members are in this group?" | **Not specified**          |
| `poll_votes`              | `poll_id`               | Join to polls                      | **Not specified**          |
| `messages`                | `channel_id`            | Specified as index                 | OK                         |
| `webhook_deliveries`      | `webhook_id`            | Specified as composite             | OK                         |
| `subsystem_memberships`   | (all in encrypted_data) | Cannot be indexed                  | **Design issue** (see B21) |

### E2. Missing WHERE clause indexes

| Table                | Column          | Query Pattern                     | Index?            |
| -------------------- | --------------- | --------------------------------- | ----------------- |
| `sessions`           | `revoked`       | "Active sessions" filter          | **Not specified** |
| `api_keys`           | `revoked_at`    | "Active API keys" filter          | **Not specified** |
| `api_keys`           | `key_type`      | Filter by metadata vs crypto      | **Not specified** |
| `webhook_configs`    | `enabled`       | "Active webhooks" filter          | **Not specified** |
| `webhook_deliveries` | `next_retry_at` | Retry queue polling               | **Not specified** |
| `acknowledgements`   | `confirmed`     | "Unconfirmed acks" filter         | **Not specified** |
| `polls`              | `status`        | "Open polls" filter               | **Not specified** |
| `timer_configs`      | `enabled`       | "Active timers" filter            | **Not specified** |
| `check_in_records`   | `dismissed`     | "Unanswered check-ins"            | **Not specified** |
| `friend_connections` | `status`        | "Pending/accepted/blocked" filter | **Not specified** |

### E3. Missing composite indexes

| Table                | Columns                        | Query Pattern                                  |
| -------------------- | ------------------------------ | ---------------------------------------------- |
| `fronting_sessions`  | `(system_id, end_time)`        | "Current fronters" (WHERE end_time IS NULL)    |
| `webhook_deliveries` | `(status, next_retry_at)`      | Retry queue polling                            |
| `audit_log`          | `(account_id, event_type)`     | "Failed login attempts for account"            |
| `messages`           | `(channel_id, timestamp DESC)` | Message pagination                             |
| `lifecycle_events`   | `(system_id, event_type)`      | "All splits for this system"                   |
| `key_grants`         | `(bucket_id, friend_user_id)`  | "Does this friend have this bucket?" (unique?) |

### E4. Missing unique constraints

| Table                     | Columns                                    | Rationale                                   |
| ------------------------- | ------------------------------------------ | ------------------------------------------- |
| `group_memberships`       | `(group_id, member_id)`                    | Prevent duplicate membership                |
| `field_bucket_visibility` | `(field_definition_id, bucket_id)`         | Prevent duplicate visibility                |
| `key_grants`              | `(bucket_id, friend_user_id, key_version)` | One grant per friend per bucket per version |
| `friend_connections`      | `(system_id, friend_system_id)`            | Prevent duplicate friend connections        |
| `nomenclature_settings`   | `system_id`                                | Already PK, good                            |
| `innerworld_canvas`       | `system_id`                                | Already PK, good                            |

### E5. Full-text search indexes

FTS is client-side only (FTS5 on decrypted data). No server-side FTS indexes needed. However, the client-side FTS5 virtual table schema should be defined somewhere (see A8).

---

## F. Views

The following query patterns would benefit from views (PostgreSQL) or application-layer query helpers (SQLite):

### F1. `current_fronters` view

```sql
SELECT * FROM fronting_sessions
WHERE end_time IS NULL AND system_id = ?
```

Most frequently accessed query in the app. Should be a view on PG, a named query on SQLite.

### F2. `active_api_keys` view

```sql
SELECT * FROM api_keys
WHERE revoked_at IS NULL AND account_id = ?
```

### F3. `pending_friend_requests` view

```sql
SELECT * FROM friend_connections
WHERE status = 'pending' AND friend_system_id = ?
```

### F4. `pending_webhook_retries` view

```sql
SELECT * FROM webhook_deliveries
WHERE status = 'failed' AND attempt_count < 5 AND next_retry_at <= NOW()
```

### F5. `unconfirmed_acknowledgements` view

```sql
SELECT * FROM acknowledgements
WHERE confirmed = false AND system_id = ?
```

### F6. `member_group_summary` view

Joining `group_memberships` with `groups` and `members` for the "which groups does this member belong to" display (features.md section 1: "Group membership display").

**Note:** Views involving encrypted_data columns have limited utility server-side since the server cannot read the encrypted content. Views are most useful for T3 metadata queries.

---

## G. Encryption Tier Annotations

### G1. Well-annotated beans

The following beans correctly annotate every column with its encryption tier: `db-s6p9`, `db-i2gl`, `db-82q2`, `db-7er7`, `db-3h1c`, `db-1dza`, `db-ju0q`, `db-tu5g`, `db-puza`, `db-2e2s`, `db-k37y`, `db-1icu`, `db-nodl`, `db-k9sr`, `db-8su3`, `db-vfhd`.

### G2. Tier classification issues

| Table                | Column                   | Current Tier | Issue                                                                                       |
| -------------------- | ------------------------ | ------------ | ------------------------------------------------------------------------------------------- |
| `innerworld_regions` | `access_type`            | Plaintext    | OK for routing, but reveals structure metadata                                              |
| `innerworld_regions` | `gatekeeper_member_id`   | Plaintext    | **Should be T1** — reveals which member is a gatekeeper (see B18)                           |
| `lifecycle_events`   | `event_type`             | T3 (implied) | **Should be T1** — reveals sensitive system dynamics (splits, fusions)                      |
| `fronting_sessions`  | `start_time`, `end_time` | T3           | Correct per spec (needed for push notifications)                                            |
| `wiki_pages`         | `slug`                   | T3           | Correct per spec (needed for URL routing) — but note that slugs could leak wiki page topics |

### G3. Missing tier annotation

- `blob_metadata.purpose` — labeled T3 but the purpose string (e.g., 'avatar', 'journal-image') reveals what type of content the user stores. Consider whether this leaks meaningful information.

---

## H. Dual-Dialect Concerns (PostgreSQL + SQLite)

### H1. JSONB vs TEXT

`db-9f6f` correctly notes: "JSONB becomes TEXT on SQLite (loses @>, ->> operators, indexing)."

**Affected beans:**

- `db-tu5g` (custom fields): "PostgreSQL: options stored as JSONB inside encrypted blob after decryption; SQLite: TEXT with JSON" — correctly noted
- `db-k9sr` (audit_log): `metadata (JSON)` — needs dialect-specific type (JSONB on PG, TEXT on SQLite)
- `db-nodl` (webhook_configs): `events (varchar[] or JSON)` — arrays are PG-only; SQLite needs JSON TEXT

### H2. Array columns

- `db-3h1c` (api_keys): `scopes (varchar[] or JSON)` — PG supports arrays natively, SQLite needs JSON TEXT. Bean acknowledges this.
- `db-nodl` (webhook_configs): `events (varchar[] or JSON)` — same issue, bean acknowledges this.

### H3. Timestamp handling

`db-9f6f` notes: "Timestamp handling differs: native PG timezone vs Unix epoch in SQLite."

**Recommendation:** All beans should consistently use `UnixMillis` (integer) for cross-dialect portability, with PG-native timestamps only where PG-specific features (range queries, date functions) are required. Most beans use `created_at (T3)` without specifying the storage type.

### H4. Boolean columns

SQLite has no native boolean type (stores as 0/1 integer). This affects:

- `members.archived`, `sessions.revoked`, `polls.status` (could use varchar instead), `webhook_configs.enabled`, `timer_configs.enabled`, `check_in_records.dismissed`, `acknowledgements.confirmed`

Drizzle handles this transparently, but integration tests should verify boolean semantics on both dialects.

### H5. Recursive CTEs

`db-puza` (groups) correctly notes: "recursive CTE on PostgreSQL, iterative on SQLite." SQLite does support recursive CTEs (since 3.8.3, 2014), so both dialects can use them. However, performance characteristics differ. Similarly affects:

- `db-k37y` (subsystems): recursive self-referential FK
- `db-vfhd` (innerworld_regions): nested regions

### H6. Row-Level Security

`db-771z` correctly notes RLS is PG-only with application-level isolation for SQLite. This is well-handled.

### H7. Enum types

PG supports CREATE TYPE ... AS ENUM; SQLite uses CHECK constraints on varchar. Affected columns:

- `friend_connections.status`: 'pending'|'accepted'|'blocked'
- `api_keys.key_type`: 'metadata'|'crypto'
- `polls.status`: 'open'|'closed'
- `webhook_deliveries.status`: 'pending'|'success'|'failed'
- `innerworld_entities.entity_type`: 'member'|'region'|'landmark'
- `innerworld_regions.access_type`: 'open'|'gatekept'
- `members.completeness_level`: 'fragment'|'demi-member'|'full'

**Recommendation:** Use varchar with CHECK constraints on both dialects for portability, or use Drizzle's enum abstraction.

---

## I. Missing Constraints

### I1. CHECK constraints

| Table                | Column             | Missing Constraint                                                                  |
| -------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `fronting_sessions`  | `end_time`         | `CHECK (end_time IS NULL OR end_time > start_time)`                                 |
| `timer_configs`      | `interval_minutes` | `CHECK (interval_minutes > 0)` (inside encrypted blob — cannot enforce at DB level) |
| `blob_metadata`      | `size_bytes`       | `CHECK (size_bytes > 0)`                                                            |
| `webhook_deliveries` | `attempt_count`    | `CHECK (attempt_count >= 0)`                                                        |
| `webhook_deliveries` | `http_status`      | `CHECK (http_status BETWEEN 100 AND 599)`                                           |
| `layers`             | `sort_order`       | `CHECK (sort_order >= 0)`                                                           |
| `groups`             | `sort_order`       | `CHECK (sort_order >= 0)`                                                           |
| `board_messages`     | `sort_order`       | `CHECK (sort_order >= 0)`                                                           |

### I2. NOT NULL constraints

Most beans do not explicitly state which columns are NOT NULL. By convention:

- All `id` columns should be NOT NULL (implied by PK)
- All `system_id` FK columns should be NOT NULL
- All `created_at` columns should be NOT NULL
- `encrypted_data` should be NOT NULL (every encrypted entity must have data)

**Beans should explicitly declare NOT NULL on:**

- `blob_metadata.storage_key` — must always have a location
- `blob_metadata.content_type` — must always have a MIME type
- `api_keys.token_hash` — must always have a hash
- `api_keys.key_type` — must always have a type
- `webhook_configs.url` — must always have a URL

### I3. DEFAULT values

No beans specify DEFAULT values. Common defaults that should be defined:

| Table                | Column               | Default                                        |
| -------------------- | -------------------- | ---------------------------------------------- |
| `members`            | `archived`           | `false`                                        |
| `members`            | `completeness_level` | `'full'` (or `'fragment'`?)                    |
| `sessions`           | `revoked`            | `false`                                        |
| `webhook_configs`    | `enabled`            | `true`                                         |
| `timer_configs`      | `enabled`            | `true`                                         |
| `polls`              | `status`             | `'open'`                                       |
| `acknowledgements`   | `confirmed`          | `false`                                        |
| `check_in_records`   | `dismissed`          | `false`                                        |
| `webhook_deliveries` | `attempt_count`      | `0`                                            |
| `webhook_deliveries` | `status`             | `'pending'`                                    |
| All tables           | `created_at`         | `NOW()` (PG) / `strftime('%s','now')` (SQLite) |

### I4. Missing UNIQUE constraints

See E4 above for the full list.

---

## J. Audit/Soft-Delete Patterns

### J1. Tables WITH proper audit columns

| Table              | created_at      | updated_at        | archived_at           | Notes                            |
| ------------------ | --------------- | ----------------- | --------------------- | -------------------------------- |
| `accounts`         | Yes             | No                | No                    | Missing updated_at               |
| `systems`          | Yes             | Yes               | No                    | OK                               |
| `members`          | Yes             | Yes               | Yes (via archived_at) | OK                               |
| `journal_entries`  | Yes             | Yes               | No                    | Missing archived_at              |
| `wiki_pages`       | Yes             | Yes               | No                    | Missing archived_at              |
| `audit_log`        | Yes (timestamp) | N/A (append-only) | N/A                   | OK                               |
| `lifecycle_events` | Yes (timestamp) | N/A (append-only) | N/A                   | OK                               |
| `api_keys`         | Yes             | No                | No (has revoked_at)   | revoked_at serves as soft-delete |

### J2. Tables MISSING audit columns

| Table                 | Missing                    | Priority                           |
| --------------------- | -------------------------- | ---------------------------------- |
| `channels`            | `created_at`, `updated_at` | High — channels are edited         |
| `messages`            | `updated_at`               | Medium — if editable               |
| `board_messages`      | `created_at`, `updated_at` | High                               |
| `notes`               | `created_at`, `updated_at` | High — notes are edited frequently |
| `polls`               | `created_at`, `closed_at`  | Medium                             |
| `acknowledgements`    | `created_at`               | Medium                             |
| `buckets`             | `created_at`, `updated_at` | Medium                             |
| `key_grants`          | `created_at`               | Medium                             |
| `bucket_content_tags` | `created_at`               | Low                                |
| `field_definitions`   | `created_at`, `updated_at` | Medium                             |
| `field_values`        | `created_at`, `updated_at` | Medium                             |
| `groups`              | `created_at`, `updated_at` | Medium                             |
| `relationships`       | `created_at`               | Medium                             |
| `subsystems`          | `created_at`, `updated_at` | Medium                             |
| `side_systems`        | `created_at`, `updated_at` | Medium                             |
| `layers`              | `created_at`, `updated_at` | Medium                             |
| `custom_fronts`       | `created_at`, `updated_at` | Medium                             |
| `timer_configs`       | `created_at`, `updated_at` | Low                                |
| `check_in_records`    | `created_at`               | Low (has `scheduled_at`)           |
| `webhook_configs`     | `updated_at`               | Medium (has `created_at`)          |
| `innerworld_entities` | `created_at`, `updated_at` | Low                                |
| `innerworld_regions`  | `created_at`, `updated_at` | Low                                |
| `friend_connections`  | `updated_at`               | Medium (has `created_at`)          |

### J3. Soft-delete / archival gaps

Features.md section 1 states: "Archival — non-destructive, read-only preservation with instant restore."

Currently only `members` has an `archived`/`archived_at` pattern. The following entities should also support archival:

- **Groups** — archived groups should be preserved
- **Notes** — read-only preservation
- **Journal entries** — read-only preservation
- **Wiki pages** — read-only preservation
- **Custom fronts** — may become inactive but shouldn't be deleted (historical fronting data references them)
- **Channels** — archived channels for historical chat

---

## Summary of Critical Findings

### Must-fix (blocks correctness):

1. **B21 — `subsystem_memberships` has no queryable columns** — both IDs are inside the encrypted blob, making the table unusable for joins or lookups
2. **B4 — Co-conscious vs co-fronting cannot be computed** — needs explicit storage
3. **A3/A4 — No job queue or import tracking tables** — blocks background job functionality
4. **A5 — No CRDT sync metadata tables** — blocks offline-first sync
5. **B5 — No friend-to-bucket assignment** — `assignedBucketIds` on FriendConnection has no DB backing

### Should-fix (data integrity):

6. **B1 — No password_hash on accounts** — cannot authenticate users
7. **A1 — No push notification tables** — blocks push notification feature
8. **A2 — No friend code table** — blocks friend request initiation
9. **G2/B18 — gatekeeper_member_id is plaintext** — privacy violation
10. **G2/B20 — lifecycle event_type leaks sensitive info** — should be encrypted

### Nice-to-fix (quality/completeness):

11. All missing audit columns (J2)
12. All missing indexes on FKs (E1)
13. All missing CHECK constraints (I1)
14. All missing DEFAULT values (I3)
15. Missing branded ID consolidation (C1)
16. View definitions for common queries (F1-F6)
