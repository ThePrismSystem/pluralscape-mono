# Audit 011: Entity Archival FK Dependency Map

**Date:** 2026-03-14
**Scope:** All entities with archival support (`archived` + `archivedAt` columns) in the PostgreSQL schema
**Purpose:** Document the complete inbound FK dependency graph for every archivable entity, identify ON DELETE behaviors, and determine whether a hard delete of any archivable row is safe (CASCADE/SET NULL only) or blocked (would violate a remaining constraint).

The project principle is **non-destructive data**: entities should be archived, not hard-deleted. This audit exists to confirm that the FK graph enforces or supports that principle, and to surface any cases where hard deletion would cause silent data corruption or schema violations.

---

## Scope of This Audit

The following entities carry `archived` + `archivedAt` columns and are therefore subject to archival workflows:

| Entity                          | Table                             | Schema File           |
| ------------------------------- | --------------------------------- | --------------------- |
| Member                          | `members`                         | `pg/members.ts`       |
| Member Photo                    | `member_photos`                   | `pg/members.ts`       |
| Custom Front                    | `custom_fronts`                   | `pg/fronting.ts`      |
| Fronting Session                | `fronting_sessions`               | `pg/fronting.ts`      |
| Switch                          | `switches`                        | `pg/fronting.ts`      |
| Fronting Comment                | `fronting_comments`               | `pg/fronting.ts`      |
| Relationship                    | `relationships`                   | `pg/structure.ts`     |
| Subsystem                       | `subsystems`                      | `pg/structure.ts`     |
| Side System                     | `side_systems`                    | `pg/structure.ts`     |
| Layer                           | `layers`                          | `pg/structure.ts`     |
| Channel                         | `channels`                        | `pg/communication.ts` |
| Message                         | `messages`                        | `pg/communication.ts` |
| Board Message                   | `board_messages`                  | `pg/communication.ts` |
| Note                            | `notes`                           | `pg/communication.ts` |
| Poll                            | `polls`                           | `pg/communication.ts` |
| Poll Vote                       | `poll_votes`                      | `pg/communication.ts` |
| Acknowledgement                 | `acknowledgements`                | `pg/communication.ts` |
| Innerworld Region               | `innerworld_regions`              | `pg/innerworld.ts`    |
| Innerworld Entity               | `innerworld_entities`             | `pg/innerworld.ts`    |
| Bucket                          | `buckets`                         | `pg/privacy.ts`       |
| Friend Connection               | `friend_connections`              | `pg/privacy.ts`       |
| Friend Code                     | `friend_codes`                    | `pg/privacy.ts`       |
| Notification Config             | `notification_configs`            | `pg/notifications.ts` |
| Friend Notification Preferences | `friend_notification_preferences` | `pg/notifications.ts` |
| Webhook Config                  | `webhook_configs`                 | `pg/webhooks.ts`      |
| Webhook Delivery                | `webhook_deliveries`              | `pg/webhooks.ts`      |
| Timer Config                    | `timer_configs`                   | `pg/timers.ts`        |
| Check-in Record                 | `check_in_records`                | `pg/timers.ts`        |
| Blob Metadata                   | `blob_metadata`                   | `pg/blob-metadata.ts` |
| Journal Entry                   | `journal_entries`                 | `pg/journal.ts`       |
| Wiki Page                       | `wiki_pages`                      | `pg/journal.ts`       |
| Group                           | `groups`                          | `pg/groups.ts`        |
| Field Definition                | `field_definitions`               | `pg/custom-fields.ts` |

---

## Terminology

- **Hard delete safe**: All inbound FKs use `ON DELETE CASCADE` or `ON DELETE SET NULL`. Deleting the row will either cascade-delete children or null out the FK column, without violating any constraint.
- **Hard delete blocked**: One or more inbound FKs use the PostgreSQL default (`ON DELETE RESTRICT` or `ON DELETE NO ACTION`), or a `SET NULL` cascade would null a `NOT NULL` column, or a `CHECK` constraint would fire after the nulling. Attempting to hard-delete will raise an error unless all child rows are deleted first.
- **Special case**: The behavior is safe at the FK level but a downstream `CHECK` constraint may fire after a `SET NULL`, making the delete indirectly harmful.

---

## Entity-by-Entity Analysis

### 1. `members`

**Table:** `members`
**Inbound FK references:**

| Referencing Table   | Column(s)                             | ON DELETE | Notes                          |
| ------------------- | ------------------------------------- | --------- | ------------------------------ |
| `member_photos`     | `(member_id, system_id)`              | CASCADE   | Deletes all photos             |
| `fronting_sessions` | `(member_id, system_id)`              | SET NULL  | Nulls `member_id`              |
| `fronting_comments` | `(member_id, system_id)`              | SET NULL  | Nulls `member_id`              |
| `relationships`     | `(source_member_id, system_id)`       | SET NULL  | Nulls `source_member_id`       |
| `relationships`     | `(target_member_id, system_id)`       | SET NULL  | Nulls `target_member_id`       |
| `notes`             | `(member_id, system_id)`              | SET NULL  | Nulls `member_id`              |
| `polls`             | `(created_by_member_id, system_id)`   | SET NULL  | Nulls `created_by_member_id`   |
| `acknowledgements`  | `(created_by_member_id, system_id)`   | SET NULL  | Nulls `created_by_member_id`   |
| `check_in_records`  | `(responded_by_member_id, system_id)` | SET NULL  | Nulls `responded_by_member_id` |
| `group_memberships` | `(member_id, system_id)`              | CASCADE   | Deletes membership rows        |
| `field_values`      | `(member_id, system_id)`              | SET NULL  | Nulls `member_id`              |

**Hard delete verdict:** BLOCKED (special case)

The FK mechanics themselves are `CASCADE` or `SET NULL` — none use `RESTRICT`. However, `fronting_sessions` carries a `CHECK` constraint:

```sql
CHECK (member_id IS NOT NULL OR custom_front_id IS NOT NULL)
```

If a fronting session's only subject is a member, the `ON DELETE SET NULL` cascade will null `member_id`. With `custom_front_id` also `NULL`, the `fronting_sessions_subject_check` constraint fires and raises a violation. This is **intentional fail-loud behavior** documented in the schema: members should be archived, not deleted. Account purge (system-level `ON DELETE CASCADE`) bypasses this by nuking `fronting_sessions` entirely via the `system_id` FK.

**Action:** Never hard-delete a member. Use archival. System-level purge is safe because it cascades from `systems.id`.

---

### 2. `member_photos`

**Table:** `member_photos`
**Inbound FK references:** None — no other table references `member_photos`.

**Hard delete verdict:** SAFE (no children)

---

### 3. `custom_fronts`

**Table:** `custom_fronts`
**Inbound FK references:**

| Referencing Table   | Column(s)         | ON DELETE | Notes                                          |
| ------------------- | ----------------- | --------- | ---------------------------------------------- |
| `fronting_sessions` | `custom_front_id` | SET NULL  | Single-column FK; nulls `custom_front_id` only |

**Hard delete verdict:** BLOCKED (special case)

Same constraint risk as `members`. The `fronting_sessions_subject_check` constraint fires if a session's sole subject is this custom front and `member_id` is also `NULL`. The single-column FK (not composite) is a deliberate design: a composite `(custom_front_id, system_id)` FK with `ON DELETE SET NULL` would attempt to null `system_id`, violating its `NOT NULL` constraint. This design choice is documented in `fronting.ts`.

**Action:** Never hard-delete a custom front. Use archival.

---

### 4. `fronting_sessions`

**Table:** `fronting_sessions`
**Partition:** PARTITION BY RANGE (`start_time`). PK is composite `(id, start_time)`.
**Inbound FK references:**

| Referencing Table   | Column(s)                                              | ON DELETE | Notes                           |
| ------------------- | ------------------------------------------------------ | --------- | ------------------------------- |
| `fronting_comments` | `(fronting_session_id, system_id, session_start_time)` | CASCADE   | Deletes all comments on session |

`journal_entries.fronting_session_id` is intentionally **not** a database-enforced FK — the schema comment notes PostgreSQL cannot enforce FKs against a partitioned table without the partition key (ADR 019). That reference is application-enforced only.

**Hard delete verdict:** SAFE (all children CASCADE)

Hard deletion removes all `fronting_comments` for the session. The journal `fronting_session_id` will become a dangling reference (application layer must handle orphan detection). Archival is strongly preferred to avoid orphaning journal entries.

---

### 5. `switches`

**Table:** `switches`
**Partition:** PARTITION BY RANGE (`timestamp`). PK is composite `(id, timestamp)`.
**Inbound FK references:** None — no other table references `switches`.

**Hard delete verdict:** SAFE (no children)

`switches.member_ids` is a `JSONB` column. PostgreSQL cannot enforce FK constraints on JSONB array contents; member ID cross-validation is application-layer only.

---

### 6. `fronting_comments`

**Table:** `fronting_comments`
**Inbound FK references:** None — no other table references `fronting_comments`.

**Hard delete verdict:** SAFE (no children)

---

### 7. `relationships`

**Table:** `relationships`
**Inbound FK references:** None — no other table references `relationships`.

**Hard delete verdict:** SAFE (no children)

---

### 8. `subsystems`

**Table:** `subsystems`
**Inbound FK references:**

| Referencing Table             | Column(s)                          | ON DELETE | Notes                                |
| ----------------------------- | ---------------------------------- | --------- | ------------------------------------ |
| `subsystems` (self)           | `(parent_subsystem_id, system_id)` | SET NULL  | Nulls parent ref on child subsystems |
| `subsystem_memberships`       | `(subsystem_id, system_id)`        | CASCADE   | Deletes all memberships              |
| `subsystem_layer_links`       | `(subsystem_id, system_id)`        | CASCADE   | Deletes all layer links              |
| `subsystem_side_system_links` | `(subsystem_id, system_id)`        | CASCADE   | Deletes all side-system links        |

**Hard delete verdict:** SAFE (all CASCADE or SET NULL, no blocking constraints downstream)

Self-referential `SET NULL` on `parent_subsystem_id` correctly detaches child subsystems without deleting them.

---

### 9. `side_systems`

**Table:** `side_systems`
**Inbound FK references:**

| Referencing Table             | Column(s)                     | ON DELETE | Notes                       |
| ----------------------------- | ----------------------------- | --------- | --------------------------- |
| `side_system_memberships`     | `(side_system_id, system_id)` | CASCADE   | Deletes all memberships     |
| `subsystem_side_system_links` | `(side_system_id, system_id)` | CASCADE   | Deletes all subsystem links |
| `side_system_layer_links`     | `(side_system_id, system_id)` | CASCADE   | Deletes all layer links     |

**Hard delete verdict:** SAFE (all CASCADE)

---

### 10. `layers`

**Table:** `layers`
**Inbound FK references:**

| Referencing Table         | Column(s)               | ON DELETE | Notes                               |
| ------------------------- | ----------------------- | --------- | ----------------------------------- |
| `layer_memberships`       | `(layer_id, system_id)` | CASCADE   | Deletes all memberships             |
| `subsystem_layer_links`   | `(layer_id, system_id)` | CASCADE   | Deletes all subsystem-layer links   |
| `side_system_layer_links` | `(layer_id, system_id)` | CASCADE   | Deletes all side-system-layer links |

**Hard delete verdict:** SAFE (all CASCADE)

---

### 11. `channels`

**Table:** `channels`
**Inbound FK references:**

| Referencing Table | Column(s)                 | ON DELETE | Notes                              |
| ----------------- | ------------------------- | --------- | ---------------------------------- |
| `channels` (self) | `(parent_id, system_id)`  | SET NULL  | Nulls parent ref on child channels |
| `messages`        | `(channel_id, system_id)` | CASCADE   | Deletes all messages in channel    |

**Hard delete verdict:** SAFE (all CASCADE or SET NULL)

**Partition note:** `messages` is PARTITION BY RANGE (`timestamp`). The FK from `messages` to `channels` is a composite `(channel_id, system_id)` reference against the unique `channels_id_system_id_unique` constraint.

---

### 12. `messages`

**Table:** `messages`
**Partition:** PARTITION BY RANGE (`timestamp`). PK is composite `(id, timestamp)`.
**Inbound FK references:** None — `messages.reply_to_id` is stored but no FK is declared on it (the schema relies on an index and application-layer consistency rather than a DB-enforced self-referential FK, consistent with partitioned table limitations).

**Hard delete verdict:** SAFE (no children)

`reply_to_id` will become a dangling reference if the referenced message is hard-deleted. Application layer must handle orphan detection for threaded message display.

---

### 13. `board_messages`

**Table:** `board_messages`
**Inbound FK references:** None — no other table references `board_messages`.

**Hard delete verdict:** SAFE (no children)

---

### 14. `notes`

**Table:** `notes`
**Inbound FK references:** None — no other table references `notes`.

**Hard delete verdict:** SAFE (no children)

---

### 15. `polls`

**Table:** `polls`
**Inbound FK references:**

| Referencing Table | Column(s)              | ON DELETE | Notes             |
| ----------------- | ---------------------- | --------- | ----------------- |
| `poll_votes`      | `(poll_id, system_id)` | CASCADE   | Deletes all votes |

**Hard delete verdict:** SAFE (all CASCADE)

---

### 16. `poll_votes`

**Table:** `poll_votes`
**Inbound FK references:** None — no other table references `poll_votes`.

**Hard delete verdict:** SAFE (no children)

---

### 17. `acknowledgements`

**Table:** `acknowledgements`
**Inbound FK references:** None — no other table references `acknowledgements`.

**Hard delete verdict:** SAFE (no children)

---

### 18. `innerworld_regions`

**Table:** `innerworld_regions`
**Inbound FK references:**

| Referencing Table           | Column(s)                       | ON DELETE | Notes                                        |
| --------------------------- | ------------------------------- | --------- | -------------------------------------------- |
| `innerworld_regions` (self) | `(parent_region_id, system_id)` | SET NULL  | Nulls parent ref on child regions            |
| `innerworld_entities`       | `region_id`                     | SET NULL  | Nulls `region_id` on entities in this region |

**Hard delete verdict:** SAFE (all SET NULL, no blocking downstream constraints)

Note: `innerworld_entities.region_id` uses a single-column FK (not composite) against `innerworld_regions.id`. This mirrors the `custom_fronts` pattern — a composite with `system_id` + `ON DELETE SET NULL` would risk nulling `system_id`.

---

### 19. `innerworld_entities`

**Table:** `innerworld_entities`
**Inbound FK references:** None — no other table references `innerworld_entities`.

**Hard delete verdict:** SAFE (no children)

---

### 20. `buckets`

**Table:** `buckets`
**Inbound FK references:**

| Referencing Table           | Column(s)   | ON DELETE | Notes                                  |
| --------------------------- | ----------- | --------- | -------------------------------------- |
| `bucket_content_tags`       | `bucket_id` | CASCADE   | Deletes all content tags               |
| `key_grants`                | `bucket_id` | CASCADE   | Deletes all key grants for this bucket |
| `friend_bucket_assignments` | `bucket_id` | CASCADE   | Deletes all friend assignments         |
| `blob_metadata`             | `bucket_id` | SET NULL  | Nulls `bucket_id` on blob records      |
| `field_bucket_visibility`   | `bucket_id` | CASCADE   | Deletes all field visibility rules     |

**Hard delete verdict:** SAFE (all CASCADE or SET NULL)

Hard-deleting a bucket revokes friend access (key grants deleted), removes content tags (effectively making all tagged content invisible to friends), and removes field visibility rules. This is a significant privacy-affecting operation — archival is strongly preferred to preserve audit trails.

---

### 21. `friend_connections`

**Table:** `friend_connections`
**Inbound FK references:**

| Referencing Table                 | Column(s)                            | ON DELETE | Notes                                          |
| --------------------------------- | ------------------------------------ | --------- | ---------------------------------------------- |
| `friend_bucket_assignments`       | `friend_connection_id`               | CASCADE   | Deletes bucket assignments for this connection |
| `friend_notification_preferences` | `(friend_connection_id, account_id)` | CASCADE   | Deletes notification prefs                     |

**Hard delete verdict:** SAFE (all CASCADE)

---

### 22. `friend_codes`

**Table:** `friend_codes`
**Inbound FK references:** None — no other table references `friend_codes`.

**Hard delete verdict:** SAFE (no children)

---

### 23. `notification_configs`

**Table:** `notification_configs`
**Inbound FK references:** None — no other table references `notification_configs`.

**Hard delete verdict:** SAFE (no children)

---

### 24. `friend_notification_preferences`

**Table:** `friend_notification_preferences`
**Inbound FK references:** None — no other table references `friend_notification_preferences`.

**Hard delete verdict:** SAFE (no children)

---

### 25. `webhook_configs`

**Table:** `webhook_configs`
**Inbound FK references:**

| Referencing Table    | Column(s)                 | ON DELETE | Notes                        |
| -------------------- | ------------------------- | --------- | ---------------------------- |
| `webhook_deliveries` | `(webhook_id, system_id)` | CASCADE   | Deletes all delivery records |

**Hard delete verdict:** SAFE (all CASCADE)

Deleting a webhook config erases delivery history. Archival preserves delivery records for audit purposes.

---

### 26. `webhook_deliveries`

**Table:** `webhook_deliveries`
**Inbound FK references:** None — no other table references `webhook_deliveries`.

**Hard delete verdict:** SAFE (no children)

Note: Terminal-state delivery records (`status IN ('success', 'failed')`) are intended to be cleaned up after 30 days by a background job (blocked on bean `infra-m2t5`). This is a legitimate operational hard-delete path, not subject to the archival principle.

---

### 27. `timer_configs`

**Table:** `timer_configs`
**Inbound FK references:**

| Referencing Table  | Column(s)                      | ON DELETE | Notes                        |
| ------------------ | ------------------------------ | --------- | ---------------------------- |
| `check_in_records` | `(timer_config_id, system_id)` | CASCADE   | Deletes all check-in records |

**Hard delete verdict:** SAFE (all CASCADE)

Deleting a timer config erases all historical check-in records. Archival is strongly preferred.

---

### 28. `check_in_records`

**Table:** `check_in_records`
**Inbound FK references:** None — no other table references `check_in_records`.

**Hard delete verdict:** SAFE (no children)

---

### 29. `blob_metadata`

**Table:** `blob_metadata`
**Inbound FK references:**

| Referencing Table      | Column(s)              | ON DELETE | Notes                                  |
| ---------------------- | ---------------------- | --------- | -------------------------------------- |
| `blob_metadata` (self) | `thumbnail_of_blob_id` | SET NULL  | Nulls thumbnail reference on originals |

**Hard delete verdict:** SAFE (SET NULL only, no blocking constraints)

The self-referential FK `thumbnail_of_blob_id → id` uses `ON DELETE SET NULL`. Deleting a thumbnail blob will null the `thumbnail_of_blob_id` column on the parent blob row. Deleting an original blob will null `thumbnail_of_blob_id` on any blob that referenced it as an original (effectively orphaning thumbnails from their parent — application should clean those up).

---

### 30. `journal_entries`

**Table:** `journal_entries`
**Inbound FK references:** None — no other table references `journal_entries`.

**Hard delete verdict:** SAFE (no children)

Note: `journal_entries.fronting_session_id` is application-enforced only, not a database FK (due to partitioned table constraints, ADR 019).

---

### 31. `wiki_pages`

**Table:** `wiki_pages`
**Inbound FK references:** None — no other table references `wiki_pages`.

**Hard delete verdict:** SAFE (no children)

---

### 32. `groups`

**Table:** `groups`
**Inbound FK references:**

| Referencing Table   | Column(s)                      | ON DELETE | Notes                            |
| ------------------- | ------------------------------ | --------- | -------------------------------- |
| `groups` (self)     | `(parent_group_id, system_id)` | SET NULL  | Nulls parent ref on child groups |
| `group_memberships` | `(group_id, system_id)`        | CASCADE   | Deletes all memberships          |

**Hard delete verdict:** SAFE (all CASCADE or SET NULL)

---

### 33. `field_definitions`

**Table:** `field_definitions`
**Inbound FK references:**

| Referencing Table         | Column(s)                          | ON DELETE | Notes                               |
| ------------------------- | ---------------------------------- | --------- | ----------------------------------- |
| `field_values`            | `(field_definition_id, system_id)` | CASCADE   | Deletes all values for this field   |
| `field_bucket_visibility` | `field_definition_id`              | CASCADE   | Deletes all bucket visibility rules |

**Hard delete verdict:** SAFE (all CASCADE)

Deleting a field definition silently erases all custom field data for all members. Archival is strongly preferred to preserve historical data.

---

## Cross-Cutting Notes

### Partitioned Tables

Three tables in the schema are PARTITION BY RANGE in production (the Drizzle definition does not express this — see migration notes):

- `fronting_sessions` — partitioned on `start_time`
- `switches` — partitioned on `timestamp`
- `messages` — partitioned on `timestamp`

PostgreSQL cannot enforce FK constraints from non-partitioned tables that reference a partitioned table unless the partition key is included in the FK columns. This is why:

- `fronting_comments` uses a composite FK `(fronting_session_id, system_id, session_start_time)` — `session_start_time` is denormalized from the parent session specifically to enable this FK.
- `journal_entries.fronting_session_id` has NO database FK — application-layer enforcement only (ADR 019).
- `messages.reply_to_id` has NO database FK for the same reason.

### The `fronting_sessions_subject_check` Constraint

This `CHECK` is the most consequential constraint for the archival/deletion feature:

```sql
CHECK (member_id IS NOT NULL OR custom_front_id IS NOT NULL)
```

It makes hard-deleting `members` or `custom_fronts` potentially destructive, not just to the target row, but to the schema integrity of `fronting_sessions`. Any code path that performs hard deletion of a member or custom front must first verify:

1. No fronting session exists where this entity is the **sole subject** (both `member_id` and `custom_front_id` are not both non-null to another value).
2. If such sessions exist, the operation must fail with a clear error — not silently corrupt data.

Account-level purge is exempt because `fronting_sessions.system_id` cascades from `systems.id`, which cascades from `accounts.id`, bypassing this check by deleting the entire session rather than nulling its subject column.

### `switches.member_ids` — JSONB FK Gap

`switches.member_ids` stores member IDs as a `JSONB` array. PostgreSQL cannot enforce referential integrity over JSONB contents. Archiving or deleting a member will not clean up stale IDs in this column. Application-layer cleanup or a periodic consistency scan is required.

---

## Summary Table

| Entity (table)                    | Has Inbound FKs | Min. ON DELETE Behavior | Hard Delete | Reason / Notes                                          |
| --------------------------------- | --------------- | ----------------------- | ----------- | ------------------------------------------------------- |
| `members`                         | Yes             | SET NULL + CASCADE      | **BLOCKED** | `fronting_sessions_subject_check` can fire              |
| `member_photos`                   | No              | —                       | Safe        | No children                                             |
| `custom_fronts`                   | Yes             | SET NULL                | **BLOCKED** | `fronting_sessions_subject_check` can fire              |
| `fronting_sessions`               | Yes             | CASCADE                 | Safe        | Cascades to `fronting_comments`; journal FK is app-only |
| `switches`                        | No              | —                       | Safe        | No DB children; `member_ids` JSONB has no FK            |
| `fronting_comments`               | No              | —                       | Safe        | No children                                             |
| `relationships`                   | No              | —                       | Safe        | No children                                             |
| `subsystems`                      | Yes             | CASCADE + SET NULL      | Safe        | Self-ref SET NULL detaches children                     |
| `side_systems`                    | Yes             | CASCADE                 | Safe        | All children cascade                                    |
| `layers`                          | Yes             | CASCADE                 | Safe        | All children cascade                                    |
| `channels`                        | Yes             | CASCADE + SET NULL      | Safe        | Cascades to `messages`; self-ref SET NULL               |
| `messages`                        | No              | —                       | Safe        | No DB children; `reply_to_id` is app-only               |
| `board_messages`                  | No              | —                       | Safe        | No children                                             |
| `notes`                           | No              | —                       | Safe        | No children                                             |
| `polls`                           | Yes             | CASCADE                 | Safe        | Cascades to `poll_votes`                                |
| `poll_votes`                      | No              | —                       | Safe        | No children                                             |
| `acknowledgements`                | No              | —                       | Safe        | No children                                             |
| `innerworld_regions`              | Yes             | SET NULL                | Safe        | Self-ref SET NULL; entity `region_id` SET NULL          |
| `innerworld_entities`             | No              | —                       | Safe        | No children                                             |
| `buckets`                         | Yes             | CASCADE + SET NULL      | Safe        | Revokes all friend access on delete                     |
| `friend_connections`              | Yes             | CASCADE                 | Safe        | Cascades to assignments and prefs                       |
| `friend_codes`                    | No              | —                       | Safe        | No children                                             |
| `notification_configs`            | No              | —                       | Safe        | No children                                             |
| `friend_notification_preferences` | No              | —                       | Safe        | No children                                             |
| `webhook_configs`                 | Yes             | CASCADE                 | Safe        | Cascades to delivery records                            |
| `webhook_deliveries`              | No              | —                       | Safe        | No children; TTL cleanup is legitimate hard-delete      |
| `timer_configs`                   | Yes             | CASCADE                 | Safe        | Cascades to check-in records                            |
| `check_in_records`                | No              | —                       | Safe        | No children                                             |
| `blob_metadata`                   | Yes (self)      | SET NULL                | Safe        | Self-ref for thumbnails; no blocking constraints        |
| `journal_entries`                 | No              | —                       | Safe        | No children                                             |
| `wiki_pages`                      | No              | —                       | Safe        | No children                                             |
| `groups`                          | Yes             | CASCADE + SET NULL      | Safe        | Self-ref SET NULL; memberships cascade                  |
| `field_definitions`               | Yes             | CASCADE                 | Safe        | Cascades values and visibility rules                    |

**Entities where hard delete is blocked: `members`, `custom_fronts`**

All other archivable entities are technically safe to hard-delete at the FK level, but operational hard deletion should remain exceptional. Archival is the standard path for all user-visible entities.
