---
# mobile-5bi3
title: "Mobile: UI/UX design for bucket-key decrypt failure diagnostics"
status: todo
type: task
created_at: 2026-04-19T20:24:44Z
updated_at: 2026-04-19T20:24:44Z
parent: ps-9cca
---

Design a user-visible affordance for when BucketKeyProvider fails to decrypt grants outside expected key-rotation/revocation paths. Options to evaluate: per-bucket indicator in friends list, settings-screen failure count, banner, or diagnostics screen. Currently only logger.warn fires (apps/mobile/src/providers/bucket-key-provider.tsx around line 80). Blocks mobile data-interpolation counter work.
