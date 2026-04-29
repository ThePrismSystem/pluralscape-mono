---
# types-09m5
title: Brand FrontingSession.comment, .positionality, and .outtrigger
status: completed
type: task
priority: normal
created_at: 2026-04-27T21:25:50Z
updated_at: 2026-04-29T09:27:16Z
parent: ps-cd6x
---

Three same-entity free-text peers on FrontingSession with concrete cross-field swap risk — all three are short user-typed strings sharing one encrypted blob. Brand FrontingSessionComment, FrontingSessionPositionality, FrontingSessionOuttrigger to lock relative positions.

## Summary of Changes

Defined FrontingSessionComment, FrontingSessionPositionality, and FrontingSessionOuttrigger brands in packages/types/src/value-types.ts as a three-way same-entity peer cluster. Re-exported from packages/types/src/index.ts. Applied to FrontingSession.comment, .positionality, .outtrigger (all nullable). Updated FrontingSessionEncryptedInputSchema in packages/validation/src/fronting-session.ts to use brandedString().nullable() for each. Canonical chain inherits brands via existing Pick/Omit projections; null-passthrough preserved through Zod's .nullable() and entity-level | null union. Empty-non-null strings now reject — must be null instead — matching the lifecycle-event branding precedent.
