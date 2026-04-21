---
# sync-me6c
title: "Audit remediation: packages/sync (2026-04-20)"
status: completed
type: epic
priority: high
created_at: 2026-04-20T09:20:30Z
updated_at: 2026-04-21T00:51:07Z
parent: ps-h2gl
---

Remediation from comprehensive audit 2026-04-20. 2 High security + typing gaps. See docs/local-audits/comprehensive-audit-2026-04-20/sync.md. Tracking: ps-g937.

## Summary of Changes

Completed WT5 of the M9 audit remediation plan — all 9 sync-package
beans land in chore/audit-m9-sync:

Security:

- sync-ge3a: removed VERIFY_ENVELOPE_SIGNATURES kill-switch
- sync-ldoi: bound authorPublicKey to encryption key via AEAD AD

Performance:

- sync-f4ma: dirty-entity-type tracking in materializeDocument
- sync-192t: single-pass hash maps in diffEntities
- sync-2yh3: dirty-entity-type scoping in enforceTombstones

Typing:

- sync-aefn: AnyDocumentSession discriminated union, getTypedSession
- sync-orkv: generic applyLocalChange overload with documentType

Test coverage:

- sync-z99z: extended event-bus tests for edge paths and re-exports
- sync-qh8l: materializer test coverage at 92-96% across branches,
  statements, lines, and functions
