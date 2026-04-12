---
# ps-9uqg
title: Simply Plural import wizard UI
status: todo
type: epic
priority: normal
created_at: 2026-04-08T11:56:44Z
updated_at: 2026-04-12T06:57:34Z
parent: ps-vq2h
blocked_by:
  - ps-nrg4
---

User-facing wizard for the SP import flow built on top of the ps-nrg4 data layer.

Builds the screens, state machine, and UX writing for the import flow. The data layer (engine, mappers, server endpoints, mobile hooks) ships in ps-nrg4; this bean wires those hooks into a guided wizard.

## Scope

- Wizard host screen with internal state machine
- Step 1: Choose source (API token vs JSON export file)
- Step 2: Provide credentials (token entry + 'test connection' OR file picker for JSON + optional avatar ZIP)
- Step 3: Category opt-out checklist (defaults to all selected)
- Step 4: Confirmation with re-import detection summary
- Step 5: Live progress (uses useImportProgress subscription hook)
- Step 6: Per-collection summary with collapsible error log
- Resume prompt on app launch when an active import job exists
- Token security UX: secureTextEntry, masked display, explainer sheet, auto-wipe on completion
- Accessibility: 44pt touch targets, accessibilityLabels, accessibilityLiveRegion for progress
- Background task registration via expo-background-task

## Out of scope

- The data layer (engine, mappers, server endpoints, hooks) — that is ps-nrg4
- High-fidelity visual polish (will get a reskin during M11 design system rollout if not built against it directly)

## References

The full wizard flow is documented in [docs/planning/2026-04-08-simply-plural-import.md](../docs/planning/2026-04-08-simply-plural-import.md) — Section "Components" and the "Mobile glue" subsection lay out the data hooks this UI consumes. The integration surface (hooks) is the contract between this bean and ps-nrg4.

## Source Limitation Messaging

The wizard Step 1 (source picker) must clearly communicate what each source imports:

**API import** covers: system profile, members, groups, custom fronts, custom fields, privacy buckets, fronting history, notes (journal entries), polls, channels, and channel categories. This is all essential user data.

**File import** additionally covers: system settings, fronting comments, chat messages, and board messages.

The UI should:

- Show a brief note on the source picker explaining the difference
- NOT block API import — it covers all essential data
- Frame file import as "complete" and API import as "most data — notes included"
- If the user picks API import, do not warn about missing comments/chat/board — these are low-priority social features, not therapeutic data
- If the user needs a complete import, suggest they export from SP settings and use the file picker
