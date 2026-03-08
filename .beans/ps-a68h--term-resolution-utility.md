---
# ps-a68h
title: Term resolution utility
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:35:57Z
updated_at: 2026-03-08T13:36:04Z
parent: ps-iawz
blocked_by:
  - types-g5oo
---

Client-side term resolution from canonical terms to user-configured display terms

## Scope

- `resolveTerm(canonical: CanonicalTerm, settings: NomenclatureSettings): string`
- Pluralization: `resolveTermPlural(canonical: CanonicalTerm, settings: NomenclatureSettings): string`
- Case variants: `resolveTermLower`, `resolveTermTitle`, `resolveTermUpper`
- Canonical → display mapping for all 8 categories
- React hook (for M8): `useNomenclature(canonical: CanonicalTerm): string` — reads settings from context
- Fallback: if settings not loaded, use defaults

## Acceptance Criteria

- [ ] resolveTerm resolves all 8 canonical terms
- [ ] Pluralization support
- [ ] Case variant helpers
- [ ] Graceful fallback to defaults
- [ ] React hook interface defined (implementation in M8)
- [ ] Unit tests for resolution with custom terms
- [ ] Unit tests for pluralization edge cases

## References

- features.md section 12
