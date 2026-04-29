---
# types-09m5
title: Brand FrontingSession.comment, .positionality, and .outtrigger
status: completed
type: task
priority: normal
created_at: 2026-04-27T21:25:50Z
updated_at: 2026-04-29T07:28:11Z
parent: ps-cd6x
---

Per types-t3tn audit (2026-04-27): Three same-entity free-text peers on FrontingSession with concrete cross-field swap risk — all three are short user-typed strings sharing one encrypted blob and one set of fronting-rendering helpers. Brand FrontingSessionComment, FrontingSessionPositionality, FrontingSessionOuttrigger to lock relative positions. See docs/local-audits/2026-04-27-free-text-label-brand-audit.md.

## Summary of Changes

Defined FrontingSessionComment, FrontingSessionPositionality, and FrontingSessionOuttrigger brands in packages/types/src/value-types.ts as a three-way same-entity peer cluster. Re-exported from packages/types/src/index.ts. Applied to FrontingSession.comment, .positionality, .outtrigger (all nullable). Updated FrontingSessionEncryptedInputSchema in packages/validation/src/fronting-session.ts to use brandedString().nullable() for each. Canonical chain inherits brands via existing Pick/Omit projections; null-passthrough preserved through Zod's .nullable() and entity-level | null union. Empty-non-null strings now reject — must be null instead — matching the lifecycle-event branding precedent.
