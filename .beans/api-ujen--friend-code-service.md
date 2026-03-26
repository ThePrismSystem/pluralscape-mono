---
# api-ujen
title: Friend code service
status: todo
type: feature
created_at: 2026-03-26T16:03:59Z
updated_at: 2026-03-26T16:03:59Z
parent: api-rl9o
blocked_by:
  - api-yx3x
---

Implement generateFriendCode (ID prefix frc\_, crypto.randomBytes, human-typable XXXX-XXXX format, optional expiry), listFriendCodes (active, non-expired), archiveFriendCode, redeemFriendCode (SELECT FOR UPDATE to prevent concurrent double-redemption; validates code exists + not archived + not expired + not self-redeem; creates TWO friendConnections rows A->B and B->A both accepted; archives code). Uses friendCodeGeneration rate limit. Files: apps/api/src/services/friend-code.service.ts (new). Tests: unit + integration; expired code, self-redeem, already-friends, bidirectional creation, concurrent redemption race.
