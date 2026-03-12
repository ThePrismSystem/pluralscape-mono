---
# db-43et
title: "Database schema audit 004 fixes: C1-C4, M3, M4, M6, M7, M12, E2, S1"
status: in-progress
type: task
created_at: 2026-03-12T18:50:52Z
updated_at: 2026-03-12T18:50:52Z
---

Implement all fixes from audit 004 (comprehensive database schema audit). Covers: C1+C2 (UNIQUE(id) on partitioned tables), C3 (friend code min length CHECK), C4 (device token uniqueness), M3 (composite member FKs), M4+S1 (performance indexes), M6 (fronting_reports RLS), M7 (remove api_keys.name plaintext), M12 (composite self-referential FKs), E2 (audit_log.detail tier clarification).
