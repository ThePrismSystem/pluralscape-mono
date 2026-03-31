---
# api-fg7s
title: "Password change: document or change session revocation behavior"
status: completed
type: task
priority: normal
created_at: 2026-03-30T22:35:45Z
updated_at: 2026-03-31T07:31:45Z
parent: api-e7gt
---

Security audit finding: account.service.ts revokes all sessions EXCEPT current on password change. Compromised old device retains access if password changed elsewhere. Options: (1) document as ADR, (2) revoke ALL sessions, (3) add user-facing opt-in.

## Summary of Changes\n\nChanged changePassword() to revoke ALL sessions including the current one on password change (was: all except current). Removed the now-unused sessionId parameter from the function signature and updated the route handler and all tests. This is the most secure option — a password change forces re-authentication on every device.
