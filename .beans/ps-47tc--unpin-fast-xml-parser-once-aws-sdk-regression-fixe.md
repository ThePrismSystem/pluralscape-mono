---
# ps-47tc
title: Unpin fast-xml-parser once AWS SDK regression fixed
status: todo
type: task
priority: low
created_at: 2026-04-20T07:55:10Z
updated_at: 2026-04-20T07:55:10Z
parent: ps-vq2h
---

fast-xml-parser is pinned to `~5.5.7` via pnpm override in `package.json` and via `allowedVersions` in `renovate.json` because 5.7.x rejects `&#xD;` XML entity references in S3 response bodies, breaking `@aws-sdk/xml-builder` and causing blob storage contract tests to fail with `Invalid character '#' in entity name: "#xD"`.

## Tasks

- [ ] Check fast-xml-parser changelog for fix to `&#xD;` / entity handling regression
- [ ] Check AWS SDK (`@aws-sdk/xml-builder`, `@aws-sdk/client-s3`) for compatibility with fast-xml-parser 5.7+
- [ ] Test-run a bump (remove overrides, `pnpm install`, run `pnpm vitest run --project storage-integration`)
- [ ] If green: remove both the `pnpm.overrides` pin and the `renovate.json` packageRule
- [ ] If still broken: update this bean with latest status and keep pinned

## Context

- Original regression surfaced 2026-04-20 in PR #515 (batched Renovate updates)
- Fix commits: `c62225c5` (package.json override), `7c6c6b1d` (renovate.json rule)
- Working version: 5.5.7 (used until 2026-04-20)
- Failing versions: 5.7.0, 5.7.1
