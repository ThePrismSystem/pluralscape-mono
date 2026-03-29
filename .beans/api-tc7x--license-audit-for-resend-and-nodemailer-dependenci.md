---
# api-tc7x
title: License audit for resend and nodemailer dependencies
status: done
type: task
priority: normal
created_at: 2026-03-29T04:23:15Z
updated_at: 2026-03-29T04:23:21Z
parent: api-7xw0
---

Audit licenses for the resend SDK and nodemailer packages added in the email infrastructure epic. Verify compatibility with AGPL-3.0. Document findings.

## Summary of Changes

License audit completed. All dependencies are AGPL-3.0 compatible.

### resend v4.1.2 — MIT

Transitive dependencies:

- svix@1.86.0 — MIT
  - uuid@10 — MIT
  - standardwebhooks@1.0.0 — MIT
    - @stablelib/base64 — MIT
    - fast-sha256 — Unlicense
- postal-mime@2.7.3 — MIT-0

### nodemailer v8.0.4 — MIT-0

No transitive dependencies (zero-dependency package).

### Compatibility Verdict

All licenses (MIT, MIT-0, Unlicense) are permissive and fully compatible with AGPL-3.0. No copyleft, proprietary, or GPL-incompatible licenses found. No concerns.
