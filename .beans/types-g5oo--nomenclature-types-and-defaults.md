---
# types-g5oo
title: Nomenclature types and defaults
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:35:42Z
updated_at: 2026-03-08T19:32:27Z
parent: types-im7i
blocked_by:
  - types-av6x
---

Type definitions and default presets for the nomenclature system

## Scope

- `TermCategory`: 'collective' | 'individual' | 'fronting' | 'switching' | 'co-presence' | 'internal-space' | 'primary-fronter' | 'structure'
- `NomenclatureSettings`: Record<TermCategory, string> — selected term per category
- `TermPreset`: { category: TermCategory, presets: string[], default: string }
- Default presets per category:
  - collective: ["System", "Collective", "Household", "Crew", "Group"]
  - individual: ["Member", "Alter", "Headmate", "Part", "Insider", "Facet", "Aspect"]
  - fronting: ["Fronting", "In front", "Driving", "Piloting"]
  - switching: ["Switch", "Shift"]
  - co-presence: ["Co-fronting", "Co-conscious", "Co-driving"]
  - internal-space: ["Headspace", "Innerworld", "Wonderland"]
  - primary-fronter: ["Host", "Primary fronter", "Main fronter"]
  - structure: ["System Structure", "Topology", "Map"]
- All categories support custom user-defined values
- `CanonicalTerm` type: the API/code-internal terms (always used in code, never displayed)

## Acceptance Criteria

- [ ] All 8 term categories defined
- [ ] Preset arrays for each category
- [ ] NomenclatureSettings type matches DB schema
- [ ] CanonicalTerm type for code-internal usage
- [ ] Custom value support (not limited to presets)
- [ ] Default settings factory function
- [ ] Unit tests for preset validation

## References

- features.md section 12 (Configurable Nomenclature)
