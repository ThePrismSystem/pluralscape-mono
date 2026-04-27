---
# types-x37g
title: Brand JournalEntry.title and WikiPage.title
status: todo
type: task
created_at: 2026-04-27T21:25:47Z
updated_at: 2026-04-27T21:25:47Z
parent: ps-cd6x
---

Per types-t3tn audit (2026-04-27): Both entities expose title: string fields that flow through shared title-display helpers across long-form-content UIs. Brand JournalEntryTitle and WikiPageTitle to lock the cross-entity title slots against accidental member-name/etc. assignment. See docs/local-audits/2026-04-27-free-text-label-brand-audit.md.
