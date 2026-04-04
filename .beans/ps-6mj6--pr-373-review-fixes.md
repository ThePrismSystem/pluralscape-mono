---
# ps-6mj6
title: "PR #373 review fixes"
status: completed
type: task
priority: normal
created_at: 2026-04-04T11:10:52Z
updated_at: 2026-04-04T11:39:10Z
---

Fix all issues from PR #373 review: code fixes (canvas validator, entity transform, MemberId types, includeArchived), transform unit tests (7 files), hook test additions

## Summary of Changes

- **Canvas validator**: expanded `assertCanvasEncryptedFields` to validate all fields (viewportX, viewportY, zoom, dimensions.width, dimensions.height)
- **Entity transform**: expanded `assertInnerWorldEntityPayload` with variant-specific field checks; refactored `decryptInnerWorldEntity` to use `withArchive` helper
- **Relationship types**: changed `sourceMemberId`/`targetMemberId` to branded `MemberId | null` with wire-type override in `RelationshipRaw`
- **Snapshot test**: fixed array indexing to use destructuring pattern
- **Transform unit tests**: 7 new test files covering canvas, entity, region, relationship, snapshot, structure-entity, structure-entity-type
- **Hook tests**: added empty page edge case tests to 4 hook test files
