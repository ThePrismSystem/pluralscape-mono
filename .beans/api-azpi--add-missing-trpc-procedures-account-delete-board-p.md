---
# api-azpi
title: Add missing tRPC procedures (account delete, board pin/unpin, key rotation, misc)
status: todo
type: task
created_at: 2026-04-02T09:47:15Z
updated_at: 2026-04-02T09:47:15Z
---

Add remaining missing procedures:

- account.deleteAccount (protectedProcedure)
- boardMessage.pin, boardMessage.unpin (systemProcedure)
- bucket: initiateRotation, getRotationProgress, claimRotationChunk, completeRotationChunk, retryRotation (systemProcedure)
- structure.getHierarchy (systemProcedure)
- deviceToken.update (systemProcedure)
- apiKey.get (systemProcedure)
  See audit Domains 2, 6, 9, 11, 15.
