---
# api-fg7s
title: 'Password change: document or change session revocation behavior'
status: todo
type: task
priority: normal
created_at: 2026-03-30T22:35:45Z
updated_at: 2026-03-30T23:33:51Z
parent: api-e7gt
---

Security audit finding: account.service.ts revokes all sessions EXCEPT current on password change. Compromised old device retains access if password changed elsewhere. Options: (1) document as ADR, (2) revoke ALL sessions, (3) add user-facing opt-in.
