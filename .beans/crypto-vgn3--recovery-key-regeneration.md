---
# crypto-vgn3
title: Recovery key regeneration
status: completed
type: task
priority: normal
created_at: 2026-03-08T19:57:04Z
updated_at: 2026-03-15T07:53:48Z
parent: crypto-89v7
blocked_by:
  - crypto-sa91
---

Allow authenticated users to regenerate their recovery key, revoking the old one.

## Scope

- Regeneration from authenticated session only (user must know current password)
- Generate new RecoveryKey using same entropy source as initial generation
- Re-encrypt MasterKey with new RecoveryKey
- Replace old encrypted backup blob on server with new one
- Old RecoveryKey immediately invalidated (cannot decrypt new blob)
- Display new RecoveryKey to user with same save-it-now UX as registration
- Audit log entry for recovery key regeneration event

## Acceptance Criteria

- [ ] Regeneration requires active authenticated session
- [ ] New RecoveryKey generated with full entropy
- [ ] MasterKey re-encrypted under new key
- [ ] Old backup blob replaced atomically
- [ ] Old RecoveryKey cannot decrypt new blob
- [ ] User shown new key with save instructions
- [ ] Audit log entry created
- [ ] Unit tests for regeneration flow

## References

- ADR 011 (Key Recovery — regeneration)

## Summary of Changes\n\nImplemented recovery key regeneration:\n- New `recovery-regeneration.ts`: regenerateRecoveryKey function\n- Added auth.recovery-key-regenerated audit event type\n- Tests verify old key cannot decrypt new backup, new key recovers same MasterKey
