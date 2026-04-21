---
# ps-g5dl
title: Archive M1-M8 audits into docs/local-audits/history/
status: todo
type: task
priority: low
created_at: 2026-04-21T13:59:06Z
updated_at: 2026-04-21T13:59:06Z
parent: ps-0vwf
---

Move pre-2026-04 audit snapshots in docs/local-audits/ into a history/ subdirectory. Keeps the top level focused on the 2026-04-14 and 2026-04-20 comprehensive audits that are still actionable.

## Context

docs/local-audits/ currently contains 30+ files spanning M1-M9 audit iterations. Only the 2026-04-14 and 2026-04-20 comprehensive audits are currently referenced by active work. The M1-M8 snapshots are historical; leaving them at the top level creates version confusion.

## Scope

- [ ] mkdir docs/local-audits/history/
- [ ] git mv every file matching M1-, M2-, …, m3-, m4-, m5-, m6-, m7-, m8- prefixes into history/
- [ ] Keep at top level: comprehensive-audit-2026-04-14/, comprehensive-audit-2026-04-20/, 2026-04-10-sp-import-audit.md, 2026-04-03-trpc-skill-audit.md, and anything else dated 2026-04 or newer
- [ ] Update any READMEs or ADRs that reference moved files (grep docs/ for the old paths)
- [ ] Confirm docs/local-audits/ is still gitignored per current convention (or — if this dir has been committed on main, keep that state)

## Out of scope

- Editing audit content
- Moving per-PR review files elsewhere in docs/

## Acceptance

- docs/local-audits/ top level only contains 2026-04-dated and newer files
- docs/local-audits/history/ contains the moved files with original names preserved
- No broken links in docs/

## Priority

Low.
