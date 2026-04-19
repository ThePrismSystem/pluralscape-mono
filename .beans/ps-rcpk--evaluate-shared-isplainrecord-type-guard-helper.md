---
# ps-rcpk
title: Evaluate shared isPlainRecord type guard helper
status: scrapped
type: task
priority: low
created_at: 2026-04-19T03:23:47Z
updated_at: 2026-04-19T09:54:12Z
parent: ps-0enb
---

Multiple sites in the codebase use the 'typeof x === "object" && x !== null && !Array.isArray(x)' pattern to narrow unknown to Record<string, unknown>. Evaluate whether extracting a shared type guard (isPlainRecord / isRecord) would be a net win:

- Pro: DRY, self-documenting, one place to extend (e.g., rejecting Date/Map too)
- Con: one more import per call site, another utility to maintain, may not be worth it if occurrences are few

## Investigation todos

- [ ] Grep the codebase for the pattern: `typeof .* === "object".*null` across packages
- [ ] Count occurrences and note which packages
- [ ] If >=5 occurrences in 2+ packages, propose extracting to @pluralscape/types or @pluralscape/validation
- [ ] Otherwise, document the decision to leave inline in a short note on this bean

Origin: raised while triaging CodeQL alerts 32/33 on 2026-04-18 — we tightened the inline version in packages/sync/src/materializer/materializers/extract-entities.ts but left the question of a shared helper open.

## Reasons for Scrapping

Triaged 2026-04-19 (ps-0enb batch brainstorm). Grep across the repo surfaced only ~3 occurrences of the strict \`typeof x === 'object' && x !== null && !Array.isArray(x)\` pattern, and two of those already have local helpers (\`apps/mobile/src/data/friend-indexer.ts:isRecord\`, \`packages/data/src/rest-query-factory.ts:isApiErrorShape\`). The broader \`typeof x === 'object' && x !== null\` pattern (~25 sites) is almost entirely **error narrowing** in \`catch\` blocks — semantically distinct from record narrowing; a single helper would not cover both uses without confusion.

Below the bean's own threshold ('>= 5 occurrences in 2+ packages') and leaving inline has clear advantages (zero import cost at the handful of call sites, each site free to narrow further with domain-specific guards).
