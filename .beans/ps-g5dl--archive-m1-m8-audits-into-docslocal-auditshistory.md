---
# ps-g5dl
title: Archive M1-M8 audits into docs/local-audits/history/
status: completed
type: task
priority: low
created_at: 2026-04-21T13:59:06Z
updated_at: 2026-04-21T14:37:44Z
parent: ps-0vwf
---

Move pre-2026-04 audit snapshots in docs/local-audits/ into a history/ subdirectory. Keeps the top level focused on the 2026-04-14 and 2026-04-20 comprehensive audits that are still actionable.

## Context

docs/local-audits/ currently contains 30+ files spanning M1-M9 audit iterations. Only the 2026-04-14 and 2026-04-20 comprehensive audits are currently referenced by active work. The M1-M8 snapshots are historical; leaving them at the top level creates version confusion.

## Scope

- [x] mkdir docs/local-audits/history/
- [x] git mv every file matching M1-, M2-, …, m3-, m4-, m5-, m6-, m7-, m8- prefixes into history/
- [x] Keep at top level: comprehensive-audit-2026-04-14/, comprehensive-audit-2026-04-20/, 2026-04-10-sp-import-audit.md, 2026-04-03-trpc-skill-audit.md, and anything else dated 2026-04 or newer
- [x] Update any READMEs or ADRs that reference moved files (grep docs/ for the old paths)
- [x] Confirm docs/local-audits/ is still gitignored per current convention (or — if this dir has been committed on main, keep that state)

## Out of scope

- Editing audit content
- Moving per-PR review files elsewhere in docs/

## Acceptance

- docs/local-audits/ top level only contains 2026-04-dated and newer files
- docs/local-audits/history/ contains the moved files with original names preserved
- No broken links in docs/

## Priority

Low.

## Summary of Changes

- Created `docs/local-audits/history/` and moved five M-numbered audit files into it:
  - m3-audit-remediation-plan.md
  - m3-comprehensive-audit.md
  - m4-crdt-sync-audit.md
  - m6-audit-1.md
  - m8-comprehensive-audit.md
- Bean body anticipated "M1-M8, 30+ files"; actual top-level M-numbered files were only the five above. Remaining top-level entries are 2026-04-dated audits and the comprehensive-audit-2026-04-\* directories, which stay in place.
- No docs/ cross-links referenced the moved files. (Hits in docs/superpowers/ are local-only per .gitignore:73.)
- `docs/local-audits/` is gitignored (.gitignore:73); the only committed change is this bean file.
