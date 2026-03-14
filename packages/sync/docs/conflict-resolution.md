# Conflict Resolution Specification

## Overview

This document specifies the conflict resolution strategy for every entity type synced via Automerge CRDT in Pluralscape. For each entity, it defines the storage type, mutation semantics, conflict scenarios, and expected outcomes after merge.

This specification supersedes any informal CRDT notes in the topology document and should be the authoritative reference for schema design (sync-y3ps), adapter integration (sync-pl87), and test authorship (sync-l0ky).

### Key Design Decisions

**No automerge-repo.** The sync layer uses raw `@automerge/automerge` directly, not the `automerge-repo` library.

Rationale:

- The encryption layer (secsync pattern) encrypts individual changes before transmission. `automerge-repo` uses its own plaintext sync protocol internally — it would need to be completely bypassed.
- `automerge-repo`'s `DocHandle` assumes URL-based document discovery; Pluralscape uses manifest-based discovery.
- The `StorageAdapter` interface in `automerge-repo` doesn't pass encryption key context.
- `EncryptedSyncSession<T>` already provides the right abstraction (~100 lines vs ~50 KB library).

**ImmutableString for all V1 string fields.** In Automerge 3.x, plain `string` properties are collaborative text (character-level CRDT merge). `ImmutableString` gives whole-value LWW semantics — assigning a new value atomically replaces the old one.

- Fields like `name`, `description`, IDs, enum values: use `ImmutableString` (LWW on whole value).
- Future collaborative editing fields (journal content): would use plain `string`.
- V1: **all string fields use `ImmutableString`** — character-level collaborative editing is deferred.

---

## Storage Type Taxonomy

| Storage Type    | Automerge Type                  | Semantics                                                                                             |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `lww-map`       | `Record<string, CrdtEntity>`    | Keyed by entity ID; each field is LWW                                                                 |
| `append-only`   | `CrdtEntity[]` (list)           | Items only ever appended; never mutated in place                                                      |
| `append-lww`    | `Record<string, CrdtEntity>`    | Keyed by entity ID; new entities added via map key assignment; specific fields mutable after creation |
| `junction-map`  | `Record<string, true>`          | Compound key `{id1}_{id2}` → `true`; add-wins semantics                                               |
| `singleton-lww` | `CrdtEntity` (at document root) | One instance per document; all fields are LWW                                                         |

---

## Per-Entity CRDT Strategy

### system-core Document Entities

| Entity              | Storage Type    | Mutable Fields After Creation                                                                                                                        | Notes                                                             |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `system`            | `singleton-lww` | name, displayName, description, avatarSource                                                                                                         | Profile data; LWW per field                                       |
| `member`            | `lww-map`       | name, pronouns, description, avatarSource, colors, saturationLevel, tags, suppressFriendFrontNotification, boardMessageNotificationOnFront, archived | All profile fields LWW                                            |
| `member-photo`      | `lww-map`       | imageSource, sortOrder, caption, archived                                                                                                            | Photo metadata only; binary in blob storage                       |
| `group`             | `lww-map`       | name, description, parentGroupId, imageSource, color, emoji, sortOrder, archived                                                                     | Hierarchy via `parentGroupId`                                     |
| `subsystem`         | `lww-map`       | name, description, parentSubsystemId, architectureType, hasCore, discoveryStatus, visual fields, archived                                            | Hierarchy via `parentSubsystemId`                                 |
| `side-system`       | `lww-map`       | name, description, visual fields, archived                                                                                                           |                                                                   |
| `layer`             | `lww-map`       | name, description, accessType, gatekeeperMemberIds, visual fields, archived                                                                          | `gatekeeperMemberIds` serialized as ImmutableString (JSON)        |
| `relationship`      | `lww-map`       | type, label, bidirectional, archived                                                                                                                 |                                                                   |
| `custom-front`      | `lww-map`       | name, description, color, emoji, archived                                                                                                            |                                                                   |
| `field-definition`  | `lww-map`       | name, description, fieldType, options, required, sortOrder, archived                                                                                 |                                                                   |
| `field-value`       | `lww-map`       | value, updatedAt                                                                                                                                     | Keyed by fieldValueId; `value` is JSON-serialized FieldValueUnion |
| `system-settings`   | `singleton-lww` | all fields                                                                                                                                           | LWW per field on the settings singleton                           |
| `innerworld-entity` | `lww-map`       | positionX, positionY, visual, regionId, entity-specific fields, archived                                                                             | Flattened from discriminated union                                |
| `innerworld-region` | `lww-map`       | name, description, parentRegionId, visual, boundaryData, accessType, gatekeeperMemberIds, archived                                                   |                                                                   |
| `timer`             | `lww-map`       | intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, promptText, enabled, archived                                                              |                                                                   |
| `lifecycle-event`   | `append-only`   | (none — immutable)                                                                                                                                   | List in system-core document                                      |

#### system-core Junction Maps

Junctions use compound keys (`{parentId}_{childId}`) mapped to `true`. Add-wins: concurrent add+remove results in the junction being present.

| Junction                     | Key Format                     | Notes                         |
| ---------------------------- | ------------------------------ | ----------------------------- |
| `group-membership`           | `{groupId}_{memberId}`         | Member belongs to group       |
| `subsystem-membership`       | `{subsystemId}_{memberId}`     | Member belongs to subsystem   |
| `side-system-membership`     | `{sideSystemId}_{memberId}`    | Member belongs to side system |
| `layer-membership`           | `{layerId}_{memberId}`         | Member belongs to layer       |
| `subsystem-layer-link`       | `{subsystemId}_{layerId}`      | Cross-structure relationship  |
| `subsystem-side-system-link` | `{subsystemId}_{sideSystemId}` | Cross-structure relationship  |
| `side-system-layer-link`     | `{sideSystemId}_{layerId}`     | Cross-structure relationship  |

---

### fronting Document Entities

| Entity             | Storage Type       | Mutable Fields After Creation                         | Notes                                                                                                                                                        |
| ------------------ | ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fronting-session` | `append-lww` (map) | endTime, comment, positionality, archived             | Created on switch-in; `endTime` set on switch-out                                                                                                            |
| `fronting-comment` | `lww-map`          | content, archived                                     | Comments on sessions                                                                                                                                         |
| `switch`           | `append-only`      | (none — immutable)                                    | Records the moment control transfers                                                                                                                         |
| `check-in-record`  | `append-lww` (map) | respondedByMemberId, respondedAt, dismissed, archived | **Topology correction:** was append-only in v1 spec; modeled as map because `respondedByMemberId`, `respondedAt`, and `dismissed` are mutated after creation |

---

### chat Document Entities

| Entity            | Storage Type       | Mutable Fields After Creation                  | Notes                                                                                                                           |
| ----------------- | ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `channel`         | `singleton-lww`    | name, type, parentId, sortOrder, archived      | Channel metadata singleton                                                                                                      |
| `message`         | `append-only`      | (none — immutable)                             | Edits produce new entries with `editOf` reference                                                                               |
| `board-message`   | `append-lww` (map) | pinned, sortOrder, archived                    | **Topology correction:** was append-only in v1 spec; modeled as map because `pinned` and `sortOrder` are mutated after creation |
| `poll`            | `lww-map`          | title, description, status, closedAt, archived | `status` set to "closed" on close                                                                                               |
| `poll-option`     | `lww-map`          | label, color, emoji                            | `voteCount` omitted — computed at read time from votes list                                                                     |
| `poll-vote`       | `append-only`      | (none — immutable)                             | Votes are permanent records                                                                                                     |
| `acknowledgement` | `lww-map`          | confirmed, confirmedAt, archived               | `confirmed` and `confirmedAt` mutated when acknowledged                                                                         |

---

### journal Document Entities

| Entity          | Storage Type       | Mutable Fields After Creation                                        | Notes                                |
| --------------- | ------------------ | -------------------------------------------------------------------- | ------------------------------------ |
| `journal-entry` | `append-lww` (map) | title, blocks, tags, linkedEntities, archived                        | Content can be edited after creation |
| `wiki-page`     | `lww-map`          | title, slug, blocks, linkedFromPages, tags, linkedEntities, archived | Collaboratively editable             |
| `note`          | `lww-map`          | title, content, backgroundColor, archived                            |                                      |

---

### privacy-config Document Entities

| Entity                | Storage Type       | Mutable Fields After Creation                              | Notes                                                                 |
| --------------------- | ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `bucket` (definition) | `lww-map`          | name, description, archived                                |                                                                       |
| `bucket-content-tag`  | `lww-map`          | (structural)                                               | Compound key `{entityType}_{entityId}_{bucketId}` → tag record        |
| `friend-connection`   | `lww-map`          | status, assignedBuckets (nested map), visibility, archived | `assignedBuckets` is a nested `Record<string, true>` map for add-wins |
| `friend-code`         | `lww-map`          | archived                                                   | Immutable except for soft-delete                                      |
| `key-grant`           | `append-lww` (map) | revokedAt                                                  | Created once; `revokedAt` is the only mutable field                   |

---

### bucket Document Entities

Bucket documents contain projections (filtered copies) of entities from master-key documents. They use the same `Crdt*` types as the source documents, filtered by `BucketVisibilityScope`.

| Scope             | Projected Entity Types                  |
| ----------------- | --------------------------------------- |
| `members`         | `CrdtMember`                            |
| `member-photos`   | `CrdtMemberPhoto`                       |
| `groups`          | `CrdtGroup`                             |
| `custom-fronts`   | `CrdtCustomFront`                       |
| `custom-fields`   | `CrdtFieldDefinition`, `CrdtFieldValue` |
| `fronting-status` | `CrdtFrontingSession` (active only)     |
| `notes`           | `CrdtNote`                              |
| `journal-entries` | `CrdtJournalEntry`                      |
| `chat`            | `CrdtChannel`, `CrdtChatMessage`        |

---

## Document Schema Pseudocode

### SystemCoreDocument

```
SystemCoreDocument {
  system: CrdtSystem                                  // singleton LWW
  systemSettings: CrdtSystemSettings                  // singleton LWW
  members: Record<id, CrdtMember>
  memberPhotos: Record<id, CrdtMemberPhoto>
  groups: Record<id, CrdtGroup>
  subsystems: Record<id, CrdtSubsystem>
  sideSystems: Record<id, CrdtSideSystem>
  layers: Record<id, CrdtLayer>
  relationships: Record<id, CrdtRelationship>
  customFronts: Record<id, CrdtCustomFront>
  fieldDefinitions: Record<id, CrdtFieldDefinition>
  fieldValues: Record<id, CrdtFieldValue>
  innerWorldEntities: Record<id, CrdtInnerWorldEntity>
  innerWorldRegions: Record<id, CrdtInnerWorldRegion>
  timers: Record<id, CrdtTimer>
  lifecycleEvents: CrdtLifecycleEvent[]               // append-only
  groupMemberships: Record<"gid_mid", true>            // junction add-wins
  subsystemMemberships: Record<"ssid_mid", true>
  sideSystemMemberships: Record<"sid_mid", true>
  layerMemberships: Record<"lid_mid", true>
  subsystemLayerLinks: Record<"ssid_lid", true>
  subsystemSideSystemLinks: Record<"ssid_sid", true>
  sideSystemLayerLinks: Record<"sid_lid", true>
}
```

### FrontingDocument

```
FrontingDocument {
  sessions: Record<id, CrdtFrontingSession>           // append-lww
  comments: Record<id, CrdtFrontingComment>           // lww-map
  switches: CrdtSwitch[]                              // append-only
  checkInRecords: Record<id, CrdtCheckInRecord>       // append-lww (correction)
}
```

### ChatDocument

```
ChatDocument {
  channel: CrdtChannel                                // singleton LWW
  boardMessages: Record<id, CrdtBoardMessage>         // append-lww (correction)
  polls: Record<id, CrdtPoll>                         // lww-map
  pollOptions: Record<id, CrdtPollOption>             // lww-map
  acknowledgements: Record<id, CrdtAcknowledgementRequest> // lww-map
  messages: CrdtChatMessage[]                         // append-only
  votes: CrdtPollVote[]                              // append-only
}
```

### JournalDocument

```
JournalDocument {
  entries: Record<id, CrdtJournalEntry>               // append-lww
  wikiPages: Record<id, CrdtWikiPage>                 // lww-map
  notes: Record<id, CrdtNote>                         // lww-map
}
```

### PrivacyConfigDocument

```
PrivacyConfigDocument {
  buckets: Record<id, CrdtPrivacyBucket>              // lww-map
  contentTags: Record<"type_eid_bid", CrdtBucketContentTag> // lww-map
  friendConnections: Record<id, CrdtFriendConnection> // lww-map w/ nested assignedBuckets map
  friendCodes: Record<id, CrdtFriendCode>             // lww-map
  keyGrants: Record<id, CrdtKeyGrant>                 // append-lww
}
```

---

## Conflict Scenarios and Resolutions

### Category 1: Concurrent Edits to Same LWW Map Entity

**Scenario:** Device A and Device B both edit `member["mem_123"]` concurrently.

**Case 1a — Different fields:**

- A edits `name`, B edits `pronouns`
- After merge: both edits survive (LWW per field, different keys → no conflict)

**Case 1b — Same field:**

- A and B both set `name`
- After merge: Automerge's causal LWW picks one winner deterministically (based on actor ID ordering when clocks tie)
- **Expected:** both sessions converge to the same value regardless of apply order

**Case 1c — Concurrent archive + edit:**

- A sets `archived = true`, B edits `name`
- After merge: entity has `archived = true` AND the new name from B
- **Resolution:** both changes apply independently; archived entities retain their last known state

---

### Category 2: Concurrent Appends to Lists

**Scenario:** Device A and Device B both append to `switches[]` concurrently.

- A appends switch `sw_aaa`, B appends switch `sw_bbb`
- After merge: list contains both entries (order determined by Automerge's causal ordering)
- **Expected:** no entries lost; both `sw_aaa` and `sw_bbb` present

---

### Category 3: Concurrent FrontingSession End Time

**Scenario:** Device A and Device B both attempt to end the same fronting session concurrently (e.g., auto-timeout on device A vs explicit switch on device B).

- A sets `sessions["fs_123"].endTime = t1`
- B sets `sessions["fs_123"].endTime = t2`
- After merge: LWW picks one end time
- **Resolution:** the winning `endTime` determines when the session is considered ended; the other end time is lost
- **Acceptance:** convergence to a single definite end time is correct; which end time wins is not safety-critical

---

### Category 4: Concurrent Re-Parenting Creating a Cycle

**Scenario:** Device A sets `groupA.parentGroupId = groupB`, Device B sets `groupB.parentGroupId = groupA` concurrently.

- After merge: both changes apply → cycle in group hierarchy
- **Post-merge validation:** the client must detect and break cycles after merge
- **Detection strategy:** DFS traversal starting from each root; any node visited twice indicates a cycle
- **Resolution:** break the cycle by setting the parentGroupId of the most-recently-updated node to null (making it a root group)

A similar scenario applies to `subsystem.parentSubsystemId` and `innerWorldRegion.parentRegionId`.

---

### Category 5: Concurrent KeyGrant Revocation

**Scenario:** Device A and Device B both revoke the same key grant (e.g., two admin devices acting simultaneously).

- A sets `keyGrants["kg_123"].revokedAt = t1`
- B sets `keyGrants["kg_123"].revokedAt = t2`
- After merge: LWW picks one `revokedAt` value
- **Outcome:** the grant is revoked regardless of which timestamp wins; both concurrent revocations result in a revoked state
- This is an idempotent operation from a security perspective — any revocation is valid

---

### Category 6: Junction Add-Wins Semantics

**Scenario:** Device A adds `groupMemberships["g1_m1"] = true`, Device B concurrently deletes the same key.

- Automerge delete is modeled by setting to `undefined` or deleting the key
- In Automerge map semantics, concurrent set and delete: **the set wins** (add-wins)
- **Expected:** after merge, the junction is present (`true`)
- **Rationale:** losing data (a membership) is more harmful than having a spurious membership; the user can manually remove it

---

### Category 7: Concurrent CheckInRecord Respond + Dismiss

**Scenario:** Two devices act on the same `CheckInRecord` concurrently: one responds (`respondedByMemberId` set, `respondedAt` set, `dismissed = false`) and one dismisses (`dismissed = true`, respondedBy fields null).

- After merge: all fields are LWW independently
- **Potential conflict:** `respondedByMemberId` is set but `dismissed` is also `true`
- **Post-merge normalization:** if `respondedByMemberId` is non-null, set `dismissed = false` (response takes priority over dismiss)

---

### Category 8: Sort Order Conflicts

**Scenario:** Device A and Device B both reorder items in a sorted collection (e.g., `group.sortOrder` or `boardMessage.sortOrder`) concurrently.

- After merge: each item has an LWW `sortOrder` value; there may be ties or inversions
- **Post-merge normalization:** re-number items by ascending `sortOrder` to eliminate ties and fill gaps. Normalization is client-side and produces a new change.

---

### Category 9: ChatMessage Edit Chain

**Scenario:** Messages are append-only and immutable. Edits produce new message entries with `editOf` referencing the original.

- Device A posts `msg_1`, then posts edit `msg_2` with `editOf = "msg_1"`
- Device B receives both
- **Resolution:** the canonical content of `msg_1` is the content of the most-recent message in the `editOf` chain
- No conflicts possible on immutable messages themselves

---

### Category 10: Concurrent FriendConnection Bucket Assignment

**Scenario:** Device A adds bucket `bkt_x` to `friendConnections["fc_1"].assignedBuckets`, Device B concurrently removes `bkt_y` from the same connection.

- `assignedBuckets` is a nested map `Record<string, true>`
- A: `assignedBuckets["bkt_x"] = true` (add)
- B: deletes `assignedBuckets["bkt_y"]` (remove)
- After merge: `bkt_x` is present (add-wins), `bkt_y` is absent (delete applied since no concurrent add)
- **Expected:** both operations apply independently

---

## Edge Cases

### Polyfragmented Systems (500+ Members)

`system-core` grows to ~2.5 MB for 500+ members. This is within Automerge's efficient range. All conflict resolution strategies above apply without change at this scale.

### Tombstone Compaction

Archived entities (`archived: true`) remain in the Automerge document as LWW map entries. Snapshots include the current state (including archived flag), effectively compressing the history of the archival operation without losing the entity's last known state.

### Cross-Document Reference Consistency

CRDT documents don't enforce referential integrity — `FrontingSession.memberId` referencing a `Member` that was concurrently archived is possible. Clients must tolerate dangling references by falling back to the entity's last known data.

---

## Post-Merge Validation Rules

The following validations must run client-side after merging any CRDT changes:

| Rule                                 | Trigger                                                       | Action                                                                    |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Cycle detection (groups)             | Any `group.parentGroupId` change                              | DFS from each root; break cycles by nullifying most-recently-updated node |
| Cycle detection (subsystems)         | Any `subsystem.parentSubsystemId` change                      | Same as above                                                             |
| Cycle detection (innerworld regions) | Any `innerWorldRegion.parentRegionId` change                  | Same as above                                                             |
| Sort order normalization             | Any `sortOrder` change on groups, board messages              | Re-number ascending to eliminate ties                                     |
| CheckInRecord normalization          | Any `checkInRecord.respondedByMemberId` or `dismissed` change | If respondedByMemberId non-null → dismissed = false                       |
| FriendConnection status coherence    | Any `friendConnection.status` change                          | If status = "removed" or "blocked" → clear assignedBuckets                |
