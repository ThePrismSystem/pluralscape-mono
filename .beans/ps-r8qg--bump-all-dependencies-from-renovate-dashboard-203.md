---
# ps-r8qg
title: "Bump all dependencies from Renovate dashboard #203"
status: completed
type: task
priority: normal
created_at: 2026-04-05T23:00:41Z
updated_at: 2026-04-05T23:14:27Z
---

Update all dependencies listed in the Renovate dashboard (GH issue #203):

- PR #380: @electric-sql/pglite 0.4.2→0.4.3, @playwright/test 1.58.2→1.59.1, @redocly/cli 2.25.3→2.25.4, @types/node patches, eslint 10.1.0→10.2.0, knip 6.1.1→6.3.0, postgres 3.4.8→3.4.9, turbo 2.9.1→2.9.4, vitest-mock-extended 3.1.0→3.1.1
- PR #381: @types/nodemailer ^7→^8
- PR #361: @electric-sql/pglite 0.4.2→0.4.3 (covered by #380)
- PR #368: expo-secure-store ~14.2→~55.0, expo-sqlite ~16.0→~55.0

## Tasks

- [x] Update expo-secure-store range to ~55.0.0
- [x] Update expo-sqlite range to ~55.0.0
- [x] Update @types/nodemailer range to ^8.0.0
- [x] Run pnpm update for all in-range bumps
- [x] Run /verify and fix issues

## Summary of Changes

Updated all dependencies listed in Renovate dashboard (GH issue #203):

**Range changes (package.json edits):**

- expo-secure-store: ~14.0.1 → ~55.0.0
- expo-sqlite: ~16.0.10 → ~55.0.0
- @types/nodemailer: ^7.0.0 → ^8.0.0

**In-range bumps (pnpm update):**

- @electric-sql/pglite 0.4.2 → 0.4.3
- @playwright/test 1.58.2 → 1.59.1
- @redocly/cli 2.25.3 → 2.25.4
- @types/node patches
- eslint 10.1.0 → 10.2.0
- knip 6.1.1 → 6.3.0
- postgres 3.4.8 → 3.4.9
- turbo 2.9.1 → 2.9.4
- vitest-mock-extended 3.1.0 → 3.1.1

**Bug fix:** Fixed timezone issue in formatDate ISO mode (used local getDate/getMonth/getFullYear instead of UTC variants, causing off-by-one on dates at midnight UTC)
