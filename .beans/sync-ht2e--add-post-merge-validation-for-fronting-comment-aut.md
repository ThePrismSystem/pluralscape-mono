---
# sync-ht2e
title: Add post-merge validation for fronting-comment author constraint
status: completed
type: task
priority: normal
created_at: 2026-03-24T09:25:31Z
updated_at: 2026-04-04T22:51:57Z
parent: ps-4ioj
---

DB has fronting_comments_author_check but CRDT post-merge validator has no equivalent author constraint validation.

## Summary of Changes

Added normalizeFrontingCommentAuthors() post-merge validator that detects fronting comments where all three author fields (memberId, customFrontId, structureEntityId) are null. Mirrors DB constraint fronting_comments_author_check. Uses notification-only resolution (no auto-fix) to avoid data loss risk. Wired into runAllValidations() for the fronting document type. Added frontingCommentAuthorIssues counter to PostMergeValidationResult.
