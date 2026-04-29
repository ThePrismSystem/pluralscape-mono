---
# types-0e9j
title: Archive-aware plaintext wire union for NotificationConfig/FriendCode
status: in-progress
type: task
priority: normal
created_at: 2026-04-27T22:28:59Z
updated_at: 2026-04-29T00:33:27Z
parent: ps-cd6x
---

## Context

Surfaced during PR #580 type-design review. The wire types `NotificationConfigWire = Serialize<NotificationConfigServerMetadata>` and `FriendCodeWire = Serialize<FriendCodeServerMetadata>` flatten the archive discriminant to a non-discriminated pair `{ archived: boolean; archivedAt: UnixMillis | null }`.

The domain models the same data as a discriminated union via `Archived<T>`: `{ archived: false } | { archived: true; archivedAt: UnixMillis }`. The transforms in `packages/data/src/transforms/notification-config.ts` and `packages/data/src/transforms/friend-code.ts` therefore need a runtime invariant check (`if (raw.archivedAt === null) throw new Error("Archived ... missing archivedAt")`) that compile-time types could enforce.

Encrypted entities like `MemberServerMetadata` accept the same loosening as the price of the `EncryptedWire` row-shape contract. For plaintext entities, an archive-aware wire union (e.g. `Serialize<NotificationConfig | Archived<NotificationConfig>>`) would push the invariant up into the type system and remove the runtime throw.

## Proposed scope

- Define a helper `ArchivableWire<T>` (or equivalent) in `packages/types/src/utility.ts` that derives the discriminated wire union from a domain type with the `archived: false` literal and an `Archived<T>` companion.
- Apply to plaintext archivable entities (NotificationConfig, FriendCode, plus any future plaintext archivables that emerge from `ps-6phh` consolidation).
- Update the corresponding `narrow*` transforms in `packages/data/src/transforms/` to remove the runtime `if (archivedAt === null) throw` since the discriminant guarantees it.

## Out of scope

- Encrypted entities — they go through `EncryptedWire<XServerMetadata>` and the row-shape contract requires the looser shape.

## Cross-references

- PR #580 review (multi-agent type-design analysis)
- `packages/types/src/entities/notification-config.ts:46`
- `packages/types/src/entities/friend-code.ts:37`
- `packages/data/src/transforms/notification-config.ts` (narrowNotificationConfig)
- `packages/data/src/transforms/friend-code.ts` (narrowFriendCode)
