---
# api-48ip
title: System settings CRUD
status: todo
type: task
priority: normal
created_at: 2026-03-16T11:56:58Z
updated_at: 2026-03-16T11:58:08Z
parent: api-6fv1
blocked_by:
  - api-o89k
  - api-wq3i
---

GET /systems/:systemId/settings (full SystemSettings). PUT update with OCC. Singleton per system (created during setup). T1 encrypted blob for most fields; plaintext locale, pinHash, biometricEnabled at column level.
