---
# db-l0u9
title: DB security, indexing, and typing
status: in-progress
type: task
priority: low
created_at: 2026-04-16T06:58:37Z
updated_at: 2026-04-17T06:30:26Z
parent: ps-0enb
---

Low-severity DB findings from comprehensive audit.

## Findings

- [ ] [DB-S-L1] Duplicate migration journal entries are deployment integrity risk
- [ ] [DB-S-L2] audit_log.accountId/systemId nullable with set null
- [ ] [DB-S-L3] notificationConfigs.enabled and pushEnabled default to true
- [ ] [DB-P-L1] api_keys_revoked_at_idx indexes all rows; should use partial index
- [ ] [DB-P-L2] sessions_ttl_duration_ms_idx expression index with no evident query consumer
- [ ] [DB-P-L3] getStructureEntityAssociations round-trip camelCase transformation
- [ ] [DB-T-L1] jobs.payload typed as unknown — no .$type<>()
- [ ] [DB-TC-L1] views/mappers.ts has no unit test
- [ ] [DB-TC-L2] No test for concurrent access patterns or FOR UPDATE lock semantics
