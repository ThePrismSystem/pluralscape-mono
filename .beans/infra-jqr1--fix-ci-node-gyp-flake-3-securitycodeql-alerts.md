---
# infra-jqr1
title: Fix CI node-gyp flake + 3 security/CodeQL alerts
status: in-progress
type: task
priority: normal
created_at: 2026-04-28T11:16:53Z
updated_at: 2026-04-28T11:16:53Z
---

Branch: fix/ci-node-gyp-and-deps

## Changes

1. setup-pnpm: install `node-gyp` globally so cache-miss postinstall builds (e.g., better-sqlite3-multiple-ciphers when no prebuilt) don't fail with `sh: 1: node-gyp: not found`.
2. CodeQL #40 (extract-entities.ts:88): reorder narrowing — `raw === null` first, then `typeof !== "object"`, to silence js/comparison-between-incompatible-types. Apply to all 3 occurrences (lines 58/73/88).
3. Dependabot #42 (postcss < 8.5.10): add `pnpm.overrides.postcss: >=8.5.10`. Transitive via @redocly/cli → styled-components.
4. Dependabot #41 (fast-xml-parser CVE-2026-41650 / GHSA-gh4j-gqv2-49f6): no code change. Already documented as unreachable in a95c19de — AWS XML-Builder uses XMLParser API only; CVE is in XMLBuilder. CVE listed in pnpm.auditConfig.ignoreCves. Dismiss the GitHub UI alert post-merge with reason "tolerable_risk: documented unreachable, see a95c19de".
