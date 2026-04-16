---
# ps-jdl9
title: "Import packages: security, dedup, and testing"
status: todo
type: task
priority: low
created_at: 2026-04-16T06:58:17Z
updated_at: 2026-04-16T06:58:17Z
parent: ps-0enb
---

Low-severity import-sp, import-pk, and import-core findings from comprehensive audit.

## Findings

- [ ] [IMPORTSP-S-L1] Response body size not bounded for API source
- [ ] [IMPORTSP-S-L2] SPMemberSchema.info accepts **proto** keys
- [ ] [IMPORTPK-T-L1] privacy cast loses PKPrivacySchema enum constraint
- [ ] [IMPORTCORE-P-L1] Checkpoint writes every 50 docs without intermediate flushing
- [ ] [IMPORTCORE-T-L1] collectionToEntityType called with "unknown" fallback
- [ ] [IMPORTCORE-S-L1] Single-mapper and batch-mapper paths have ~150 lines duplicated
- [ ] [IMPORTSP-TC-L1] No test for corrupted prescan state
- [ ] [IMPORTPK-TC-L1] No adversarial test for **proto**/constructor key injection
- [ ] [IMPORTCORE-TC-L1] No test for empty dependencyOrder
