---
# ps-dq5i
title: "Auth: Setup wizard (6 steps)"
status: todo
type: feature
created_at: 2026-05-17T06:34:08Z
updated_at: 2026-05-17T06:34:08Z
parent: ps-nwju
---

## Goal

Design the 6-step initial setup wizard run after sign-up + recovery key acknowledgement. All steps use the WizardStepper pattern.

## Surfaces

- Status check: `(setup)/index.tsx`
- System profile: `(setup)/profile.tsx`
- Nomenclature pick: `(setup)/nomenclature.tsx`
- Privacy primer: `(setup)/privacy.tsx`
- First member (optional): `(setup)/first-member.tsx`
- Import offer: `(setup)/import-offer.tsx`
- Complete: `(setup)/complete.tsx`

## Required states per surface

- per-step: idle, submitting, validation-failed, back / next / skip affordances
- final: success summary with deep-link to home

## Mode notes

- Littles: wizard shortened to profile + nomenclature + complete; primer + first-member + import-offer hidden
- All modes: step indicator (top progress) visible across the flow

## Primitives required

- WizardStepper (pattern, ps-rhno)
- TextField, RadioGroup (nomenclature preset), Button, Banner, MemberCard (first-member preview), Accordion (privacy primer expandable sections)

## Data refs (informational)

- `apps/api/src/trpc/routers/system.ts` setup wizard endpoints (status check, profile, nomenclature, complete)
- `apps/api/src/trpc/routers/member.ts` (first member create)

## Required output

- [ ] docs/design-system/preview/auth-setup-wizard.html with all 6 steps + states
- [ ] Rationale on which steps are skippable and which are required

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond above (Phase 3 sweep), the WizardStepper pattern itself (Phase 0)
