---
# ps-405v
title: Import wizard dedup against existing Pluralscape buckets
status: todo
type: feature
created_at: 2026-04-09T20:41:04Z
updated_at: 2026-04-09T20:41:04Z
parent: ps-9uqg
---

Mobile import wizard detects when pre-existing Pluralscape buckets share names with synthesized legacy buckets (Public/Trusted/Private) or real SP buckets. Prompts user: merge with existing or create '<name> (imported)'. Applies choice during import job setup. Deferred from PR #402 review (2026-04-09) when the import-sp engine's dead reusedPluralscapeId dedup branch was removed — dedup moved to caller responsibility.
