---
# api-g4c6
title: Add file size limit to SP import parser
status: completed
type: task
priority: high
created_at: 2026-04-14T06:39:49Z
updated_at: 2026-04-14T07:18:51Z
parent: ps-9ujv
---

**Finding 2 (Medium)** — OWASP A04, STRIDE DoS

The SP import file source (`packages/import-sp/src/sources/file-source.ts`) materializes the full document tree in memory before processing. Peak memory is ~2-3x file size with no maximum enforced. A large import (e.g., 500 MB) could cause OOM.

**Fix:** Add a byte counter in the read loop and throw `FileSourceParseError` when exceeding a limit (e.g., 100 MB).

Reference: security/260414-0126-stride-owasp-full-audit/findings.md#finding-2

## Summary of Changes

Added MAX_IMPORT_FILE_BYTES (250 MiB) to import-core as shared constant.

- SP file-source: byte counter in stream read loop, throws FileSourceParseError
- PK file-source: statSync check before readFileSync, throws Error
- Both accept \_maxBytes override for testing with small limits
