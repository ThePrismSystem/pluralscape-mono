---
# api-l5fo
title: Use EncryptedBlob type in fronting-report mapper
status: todo
type: task
priority: low
created_at: 2026-03-24T09:25:32Z
updated_at: 2026-03-24T09:25:32Z
parent: ps-4ioj
---

fronting-report.service.ts uses 'as Parameters<typeof encryptedBlobToBase64>[0]' instead of the EncryptedBlob type used by all other services.
