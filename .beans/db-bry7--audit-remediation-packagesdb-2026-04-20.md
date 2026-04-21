---
# db-bry7
title: "Audit remediation: packages/db (2026-04-20)"
status: completed
type: epic
priority: critical
created_at: 2026-04-20T09:20:30Z
updated_at: 2026-04-20T21:37:01Z
parent: ps-h2gl
---

Remediation from comprehensive audit 2026-04-20. 2 Critical + 2 High findings. See docs/local-audits/comprehensive-audit-2026-04-20/db.md. Tracking: ps-g937.

## Summary of Changes

Landed all 4 db audit findings:

- db-3a27 (C2): partition_name from pg_inherits no longer passed into
  sql.raw. Reconstructed via formatPartitionName(table, year, month)
  after strict regex parsing.
- db-dpp7 (C1): audit_log RLS now NULL-aware. Rows nullified by ON
  DELETE SET NULL remain in the table but are invisible to regular
  tenants; admin/forensic access requires BYPASSRLS.
- db-zy79 (H1): systems RLS now enforces id AND account_id ownership.
- db-eigy (H2): key_grants now has owner-read + friend-read SELECT
  policies; writes remain tied to the originating system.

Migrations regenerated fresh (pre-release posture):

- 0000_empty_masque.sql from Drizzle schema
- 0001_rls_all_tables.sql from RLS generator

Integration tests cover positive + negative paths for every RLS change.
All 2107 db unit + integration tests pass.
