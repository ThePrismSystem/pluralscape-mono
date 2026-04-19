---
# ps-ww2e
title: Fix ReDoS in email.constants.ts + make CodeQL fail CI on high-severity
status: in-progress
type: bug
priority: high
created_at: 2026-04-19T00:50:48Z
updated_at: 2026-04-19T00:55:52Z
---

Two CodeQL alerts (js/polynomial-redos, security_severity=high) open on main at packages/email/src/email.constants.ts:38,42. The EMAIL_REGEX /^[^\s@]+@[^\s@]+\.[^\s@]+$/ has polynomial backtracking because `.` is inside [^\s@], creating ambiguous partitions around the final `\.`.

Also: CodeQL's default setup runs on every PR but always reports check conclusion `success` regardless of alert severity, so branch protection cannot block. Need a CI gate that fails on high+ severity.

## Tasks

- [x] Replace EMAIL_REGEX with a non-backtracking linear validator
- [x] Add test cases covering ReDoS-style inputs (e.g. '!@' + '!.'.repeat(N)) to prove linear behavior
- [x] Switch to advanced CodeQL setup with SARIF gate failing on security-severity >= 7.0 (high/critical)
- [ ] Verify alerts close after fix lands on main
