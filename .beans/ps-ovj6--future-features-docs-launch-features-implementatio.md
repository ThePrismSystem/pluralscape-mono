---
# ps-ovj6
title: Future features docs + launch features implementation
status: completed
type: epic
priority: normal
created_at: 2026-03-13T20:44:10Z
updated_at: 2026-04-16T07:29:41Z
parent: ps-vtws
---

Phase 1: Create docs/future-features/ with template + 13 feature docs. Phase 2: Implement launch features L1-L10 (types, DB schema, enums). Phase 3: Update features.md, milestones.md, write ADRs 021-022.

## Summary of Changes

### Phase 1: Future Features Documentation

- Created `docs/future-features/000-template.md` with standardized frontmatter
- Extracted 4 existing future features from features.md into individual docs (001-004)
- Created 9 new future feature docs (005-013) with user stories, proposed behavior, technical considerations, and privacy implications
- Total: 14 files in docs/future-features/

### Phase 2: Launch Feature Types and Schemas

- **L1** (Fronting structure location): doc-only, noted in features.md
- **L2** (Non-system accounts): Added AccountType to auth.ts, moved friend connections/codes/key grants to account-level (accountId/friendAccountId), updated PG+SQLite schemas, views, tests, ADR 021
- **L3** (Fronting snapshot): Added FrontingSnapshotEntry/FrontingSnapshot types to journal.ts, added autoCaptureFrontingOnJournal to SystemSettings
- **L4** (Member duplication): doc-only, noted in features.md
- **L5** (Outtrigger): Added OuttriggerSentiment type and outtriggerReason/outtriggerSentiment fields to FrontingSessionBase
- **L6** (Multi-system): Added SystemListItem type to identity.ts, verified schema supports 1:many
- **L7** (System duplication): Added SystemDuplicationScope type to identity.ts
- **L8+L9** (Lifecycle events): Added StructureMoveEvent and InnerworldMoveEvent interfaces, updated union, updated LIFECYCLE_EVENT_TYPES enum
- **L10** (System snapshots): Created snapshot.ts with full type module, system*snapshots table (PG+SQLite), SystemSnapshotId/snap* prefix, snapshotSchedule setting, ADR 022

### Phase 3: Documentation Updates

- Updated features.md with all launch features (L1-L10)
- Updated milestones.md with new work items and ADR references
- Created ADR 021 (non-system accounts) and ADR 022 (system snapshots)
