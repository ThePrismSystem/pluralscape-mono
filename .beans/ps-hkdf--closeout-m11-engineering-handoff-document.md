---
# ps-hkdf
title: "Closeout: M11 engineering handoff document"
status: todo
type: task
priority: normal
created_at: 2026-05-17T06:53:15Z
updated_at: 2026-05-17T06:53:31Z
parent: ps-l9fv
blocked_by:
  - ps-oqs8
  - ps-z1og
---

## Goal

Produce the engineering-facing M11 handoff document at docs/design-system/handoff-m11.md covering everything an RN engineer needs to start the M11 buildout without re-reading every bean.

## Required sections

1. **Primitive index** — every primitive bean ID + file under docs/design-system/preview/primitives/ + token dependencies.
2. **Surface index** — every screen/flow bean ID + file under docs/design-system/preview/<domain>/ + primitives consumed.
3. **Mode coverage matrix** — surfaces × 5 modes, cells = covered / spawned-bean.
4. **State coverage matrix** — surfaces × empty/loading/error variants, cells = covered / spawned-bean.
5. **Router parity table** — tRPC routers ↔ designed surfaces (from ps-6g36 audit output).
6. **Decision log** — every non-obvious design call made during M10 (e.g., "destructive confirms use typed-match", "co-fronting visualized as parallel bars", "encryption tier badge color spec").
7. **Known gaps** — every spawned-but-unresolved follow-up bean.
8. **Recommended buildout order for M11** — vertical-slice-first: Fronting → Members → Comm → Privacy → Journal → Structure → Auth → Home → Search & Settings → Cross-cutting.

## Required output

- docs/design-system/handoff-m11.md (committed).
- This bean's `## Summary of Changes` summarizes the doc.

## Out of scope

- Implementation suggestions (RN libraries, navigation, state management) — leave to M11 brainstorm.
- ADR-style decisions that don't affect design (e.g., test framework choice).
