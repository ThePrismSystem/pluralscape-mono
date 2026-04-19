---
# ps-rcpk
title: Evaluate shared isPlainRecord type guard helper
status: todo
type: task
priority: low
created_at: 2026-04-19T03:23:47Z
updated_at: 2026-04-19T03:23:47Z
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
