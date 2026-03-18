---
# api-psj8
title: Fix multi-system ownership and consolidate ownership modules
status: todo
type: bug
priority: critical
created_at: 2026-03-18T07:12:32Z
updated_at: 2026-03-18T07:12:32Z
parent: api-i2pw
---

Three ownership modules exist (assert-system-ownership.ts, system-ownership.ts, verify-system-ownership.ts). The in-memory assertSystemOwnership sets auth.systemId from first system via leftJoin, breaking multi-system accounts. Consolidate into one module, use DB-backed verification everywhere, fix 403->404 for fail-closed privacy. Ref: audit S-2, S-5, P-1, S-13.
