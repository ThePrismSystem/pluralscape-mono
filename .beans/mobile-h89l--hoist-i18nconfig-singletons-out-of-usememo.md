---
# mobile-h89l
title: Hoist i18nConfig singletons out of useMemo
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: mobile-e3l7
---

Finding [PERF-3] from audit 2026-04-20. apps/mobile/app/\_layout.tsx:199-212. AsyncStorageI18nCache and createChainedBackend re-created on every locale change. Stateless singletons. Fix: module-level const or ref.
