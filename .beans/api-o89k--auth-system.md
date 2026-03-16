---
# api-o89k
title: Auth system
status: todo
type: epic
priority: normal
created_at: 2026-03-08T12:15:46Z
updated_at: 2026-03-16T11:32:50Z
parent: ps-rdqo
---

Registration (account + system creation, keypair generation, recovery key generation), login (Argon2id verification, session creation), logout, session management (idle/absolute TTLs per api-specification.md Section 5, lastActive throttling at 60s), recovery key backup/regeneration, biometric token enrollment. Absorbs api-xmuv (auth middleware: session/token validation). Audit log write middleware for auth events (pattern used by all subsequent epics).
