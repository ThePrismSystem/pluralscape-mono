---
# mobile-zxe4
title: "Account settings UI: audit log IP tracking opt-in"
status: todo
type: feature
created_at: 2026-03-24T19:54:32Z
updated_at: 2026-03-24T19:54:32Z
blocked_by:
  - api-j20p
---

Settings screen toggle for audit log IP tracking with confirmation dialog and email verification flow before enabling.

## Requirements

- [ ] Settings screen with toggle for 'Security audit log: log IP addresses'
- [ ] Confirmation dialog explaining what enabling this does and privacy implications
- [ ] Email confirmation flow: send verification code, user must enter it to enable (prevents accidental enablement)
- [ ] API integration with PUT /account/settings endpoint
- [ ] Display current setting state from GET /account response (auditLogIpTracking field)
- [ ] Optimistic concurrency via version field

## Notes

Requires email infrastructure to be in place for the confirmation flow. The API backend is already implemented (api-j20p).
